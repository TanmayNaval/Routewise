from typing import TypedDict, List, Dict, Any

class TravelState(TypedDict):
    # Input parameters
    destination: str
    days: int
    budget: str
    travel_style: str
    trip_type: str
    starting_location: str
    travel_mode: str
    specific_locations: str
    is_ev: bool
    ev_brand: str
    ev_model: str
    ev_battery: str
    ev_range: int
    wants_hotel: bool
    check_in_date: str
    check_out_date: str
    rooms: int
    guests: int
    price_per_night: str
    
    # DestinationAgent Output
    destinations: List[str]
    top_attractions: Dict[str, Any]
    recommended_hotels: Dict[str, Any]
    reasoning: str
    
    # ItineraryAgent Output
    day_wise_plan: Dict[str, Any]
    ev_charging_strategy: Dict[str, str]
    
    # RouteAgent Output
    route_details: Dict[str, Any]
    
    # BudgetAgent Output
    estimated_budget: Dict[str, Any]
    budget_tips: List[str]
