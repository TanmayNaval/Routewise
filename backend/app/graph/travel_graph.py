from langgraph.graph import StateGraph, START, END
from app.models.state import TravelState
from app.agents.destination_agent import destination_node
from app.agents.route_agent import route_node
from app.agents.itinerary_agent import itinerary_node
from app.agents.budget_agent import budget_node

def build_travel_graph():
    # Initialize the graph with the TypedDict state
    graph = StateGraph(TravelState)
    
    # Add Nodes
    graph.add_node("DestinationAgent", destination_node)
    graph.add_node("RouteAgent", route_node)
    graph.add_node("ItineraryAgent", itinerary_node)
    graph.add_node("BudgetAgent", budget_node)
    
    # Add Edges
    graph.add_edge(START, "DestinationAgent")
    graph.add_edge("DestinationAgent", "RouteAgent")
    graph.add_edge("RouteAgent", "ItineraryAgent")
    graph.add_edge("ItineraryAgent", "BudgetAgent")
    graph.add_edge("BudgetAgent", END)
    
    # Compile Graph
    return graph.compile()
