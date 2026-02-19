from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from app.tools import AppApiClient, LlmClient
from app.tools.embedding_client import EmbeddingClient

logger = logging.getLogger(__name__)

ENTITY_EXTRACTION_PROMPT = """Analyze the following document text and extract product knowledge entities.

For each entity, provide:
- name: A clear, concise name
- type: One of: feature, requirement, user_persona, metric, constraint, dependency, technology, stakeholder
- description: A brief description

Return a JSON array of entities. Example:
[
  {"name": "OAuth Integration", "type": "feature", "description": "Allow users to log in via Google and GitHub OAuth providers"},
  {"name": "Mobile User", "type": "user_persona", "description": "Users accessing the product from mobile devices"}
]

Document text:
{text}

Return ONLY the JSON array, no other text."""

RELATION_EXTRACTION_PROMPT = """Given these product knowledge entities, identify relationships between them.

Entities:
{entities}

For each relationship, provide:
- source: The name of the source entity (must match exactly)
- target: The name of the target entity (must match exactly)
- relationType: One of: depends_on, blocks, related_to, part_of, implements, contradicts
- strength: A float between 0 and 1 indicating relationship strength
- evidence: Brief explanation of why this relationship exists

Return a JSON array. Example:
[
  {{"source": "OAuth Integration", "target": "User Auth System", "relationType": "part_of", "strength": 0.9, "evidence": "OAuth is a component of the auth system"}}
]

Return ONLY the JSON array, no other text."""


class KnowledgeExtractor:
    """Extracts knowledge entities and relations from document content."""

    def __init__(
        self,
        llm_client: LlmClient,
        embedding_client: Optional[EmbeddingClient],
        api_client: AppApiClient,
    ) -> None:
        self.llm = llm_client
        self.embedding = embedding_client
        self.api = api_client

    async def extract(self, project_id: str, document_ids: List[str]) -> Dict[str, Any]:
        """Extract knowledge entities and relations from specified documents."""
        all_entities: List[Dict[str, Any]] = []
        source_map: Dict[str, List[str]] = {}  # entity name -> document IDs

        # Process each document
        for doc_id in document_ids:
            try:
                # Fetch chunks for this document to get text content
                chunks = await self._get_document_text(doc_id)
                if not chunks:
                    continue

                # Extract entities from combined chunk text
                text = '\n\n'.join(chunks)
                # Truncate to avoid LLM context limits
                if len(text) > 15000:
                    text = text[:15000]

                entities = await self._extract_entities(text)
                for entity in entities:
                    entity['sourceDocumentId'] = doc_id
                    name = entity.get('name', '')
                    if name not in source_map:
                        source_map[name] = []
                    source_map[name].append(doc_id)
                    all_entities.append(entity)

            except Exception as exc:
                logger.error(f'Failed to extract from document {doc_id}: {exc}')

        if not all_entities:
            return {'entities': 0, 'relations': 0}

        # Deduplicate and normalize entities by name (case-insensitive)
        deduped = self._deduplicate_entities(all_entities, source_map)
        deduped = self._normalize_entities(deduped)

        if not deduped:
            logger.warning('No valid entities after normalization for project %s', project_id)
            return {'entities': 0, 'relations': 0}

        # Generate embeddings for entities
        if self.embedding is not None:
            entity_texts = [f"{e['name']}: {e.get('description', '')}" for e in deduped]
            embeddings = await self.embedding.embed_batch(entity_texts)
        else:
            logger.warning('Embedding client unavailable; continuing knowledge extraction without embeddings')
            embeddings = [None for _ in deduped]

        # Create entities via API
        entity_payloads = []
        for entity, emb in zip(deduped, embeddings):
            payload = {
                'projectId': project_id,
                'name': entity['name'],
                'type': entity['type'],
                'description': entity.get('description'),
                'sourceDocumentIds': entity.get('sourceDocumentIds', []),
            }
            if emb is not None:
                payload['embedding'] = emb
            entity_payloads.append(payload)

        created_entities = await self.api.post('/knowledge/entities/bulk', {
            'entities': entity_payloads,
        })

        # Build name->id map for relation creation
        name_to_id = {}
        if isinstance(created_entities, list):
            for ce in created_entities:
                name_to_id[ce['name']] = ce['id']
        elif isinstance(created_entities, dict) and 'data' in created_entities:
            for ce in created_entities.get('data', created_entities):
                name_to_id[ce['name']] = ce['id']

        # Extract relations
        relations = await self._extract_relations(deduped)
        relation_payloads = []
        for rel in relations:
            source_id = name_to_id.get(rel.get('source'))
            target_id = name_to_id.get(rel.get('target'))
            if source_id and target_id:
                relation_payloads.append({
                    'projectId': project_id,
                    'sourceEntityId': source_id,
                    'targetEntityId': target_id,
                    'relationType': rel.get('relationType', 'related_to'),
                    'strength': rel.get('strength', 0.5),
                    'evidence': rel.get('evidence'),
                })

        if relation_payloads:
            await self.api.post('/knowledge/relations/bulk', {
                'relations': relation_payloads,
            })

        return {
            'entities': len(entity_payloads),
            'relations': len(relation_payloads),
        }

    async def _get_document_text(self, doc_id: str) -> List[str]:
        """Fetch chunk content for a document by querying the API."""
        try:
            chunks = await self.api.get(f'/documents/{doc_id}/chunks')
            if isinstance(chunks, dict):
                chunks = chunks.get('data', [])
            if not isinstance(chunks, list):
                return []
            return [
                str(chunk.get('content', ''))
                for chunk in chunks
                if isinstance(chunk, dict) and chunk.get('content')
            ]
        except Exception:
            return []

    async def _extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """Use LLM to extract entities from text."""
        prompt = ENTITY_EXTRACTION_PROMPT.format(text=text)
        response = await self.llm.chat(
            system='You are a product knowledge extraction assistant. Return only valid JSON.',
            user=prompt,
            temperature=0.1,
        )
        content = response.get('content') if isinstance(response, dict) else str(response)
        return self._parse_json_array(content or '')

    async def _extract_relations(self, entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Use LLM to extract relations between entities."""
        entity_summary = '\n'.join(
            f"- {e['name']} ({e['type']}): {e.get('description', 'N/A')}"
            for e in entities
        )
        prompt = RELATION_EXTRACTION_PROMPT.format(entities=entity_summary)
        response = await self.llm.chat(
            system='You are a product knowledge extraction assistant. Return only valid JSON.',
            user=prompt,
            temperature=0.1,
        )
        content = response.get('content') if isinstance(response, dict) else str(response)
        return self._parse_json_array(content or '')

    def _deduplicate_entities(
        self,
        entities: List[Dict[str, Any]],
        source_map: Dict[str, List[str]],
    ) -> List[Dict[str, Any]]:
        """Deduplicate entities by name (case-insensitive)."""
        seen: Dict[str, Dict[str, Any]] = {}
        for entity in entities:
            key = entity.get('name', '').lower().strip()
            if key not in seen:
                entity['sourceDocumentIds'] = source_map.get(entity.get('name', ''), [])
                seen[key] = entity
            else:
                # Merge source document IDs
                existing = seen[key]
                existing_ids = set(existing.get('sourceDocumentIds', []))
                new_ids = set(source_map.get(entity.get('name', ''), []))
                existing['sourceDocumentIds'] = list(existing_ids | new_ids)
        return list(seen.values())

    @staticmethod
    def _normalize_entities(entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        allowed_types = {
            'feature',
            'requirement',
            'user_persona',
            'metric',
            'constraint',
            'dependency',
            'technology',
            'stakeholder',
        }
        aliases = {
            'user persona': 'user_persona',
            'persona': 'user_persona',
            'user': 'user_persona',
            'kpi': 'metric',
            'goal': 'metric',
            'tech': 'technology',
            'technical': 'technology',
            'risk': 'constraint',
            'blocker': 'dependency',
        }

        normalized: List[Dict[str, Any]] = []
        for entity in entities:
            name = str(entity.get('name', '')).strip()
            if not name:
                continue

            raw_type = str(entity.get('type', '')).strip().lower().replace('-', '_')
            raw_type = aliases.get(raw_type, raw_type)
            raw_type = aliases.get(raw_type.replace('_', ' '), raw_type)
            entity_type = raw_type if raw_type in allowed_types else 'requirement'

            normalized.append({
                **entity,
                'name': name,
                'type': entity_type,
                'description': str(entity.get('description', '')).strip() or None,
            })
        return normalized

    @staticmethod
    def _parse_json_array(text: str) -> List[Dict[str, Any]]:
        """Parse a JSON array from LLM output, handling common issues."""
        text = text.strip()
        # Find JSON array in response
        start = text.find('[')
        end = text.rfind(']')
        if start == -1 or end == -1:
            return []
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            return []
