from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.graph.state import AgentState
from app.graph.nodes.load_user import load_user_node
from app.graph.nodes.parse_intent import parse_intent_node
from app.graph.nodes.retrieve_docs import retrieve_docs_node
from app.graph.nodes.fetch_context import fetch_context_node
from app.graph.nodes.generate_answer import generate_answer_node
from app.graph.nodes.persist import persist_node
from app.graph.nodes.search_memories import search_memories_node
from app.graph.nodes.store_memories import store_memories_node
from app.graph.services import GraphServices


def _route_after_intent(state: AgentState) -> str:
    """Route to retrieve_docs for document/knowledge queries, else straight to fetch_context."""
    intent_type = state.get('intentType', 'general_chat')
    if intent_type in ('document_qa', 'knowledge_query'):
        return 'retrieve_docs'
    return 'fetch_context'


def build_graph(services: GraphServices):
    graph = StateGraph(AgentState)

    # --- Nodes ---
    graph.add_node('load_user', load_user_node(services))
    graph.add_node('search_memories', search_memories_node(services))
    graph.add_node('parse_intent', parse_intent_node(services))
    graph.add_node('retrieve_docs', retrieve_docs_node(services))
    graph.add_node('fetch_context', fetch_context_node(services))
    graph.add_node('generate_answer', generate_answer_node(services))
    graph.add_node('store_memories', store_memories_node(services))
    graph.add_node('persist', persist_node(services))

    # --- Edges ---
    graph.set_entry_point('load_user')
    graph.add_edge('load_user', 'search_memories')
    graph.add_edge('search_memories', 'parse_intent')

    # Conditional routing: document/knowledge queries go through RAG retrieval
    graph.add_conditional_edges('parse_intent', _route_after_intent, {
        'retrieve_docs': 'retrieve_docs',
        'fetch_context': 'fetch_context',
    })

    graph.add_edge('retrieve_docs', 'fetch_context')
    graph.add_edge('fetch_context', 'generate_answer')
    graph.add_edge('generate_answer', 'store_memories')
    graph.add_edge('store_memories', 'persist')
    graph.add_edge('persist', END)

    return graph.compile()
