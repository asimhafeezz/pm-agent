from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.graph.state import AgentState
from app.graph.nodes.load_user import load_user_node
from app.graph.nodes.parse_intent import parse_intent_node
from app.graph.nodes.generate_answer import generate_answer_node
from app.graph.nodes.persist import persist_node
from app.graph.nodes.search_memories import search_memories_node
from app.graph.nodes.store_memories import store_memories_node
from app.graph.services import GraphServices

def build_graph(services: GraphServices):
    graph = StateGraph(AgentState)

    # --- Nodes ---
    graph.add_node('load_user', load_user_node(services))
    graph.add_node('search_memories', search_memories_node(services))
    graph.add_node('parse_intent', parse_intent_node(services))
    graph.add_node('generate_answer', generate_answer_node(services))
    graph.add_node('store_memories', store_memories_node(services))
    graph.add_node('persist', persist_node(services))

    # --- Edges ---
    graph.set_entry_point('load_user')
    graph.add_edge('load_user', 'search_memories')
    graph.add_edge('search_memories', 'parse_intent')
    graph.add_edge('parse_intent', 'generate_answer')
    graph.add_edge('generate_answer', 'store_memories')
    graph.add_edge('store_memories', 'persist')
    graph.add_edge('persist', END)

    return graph.compile()
