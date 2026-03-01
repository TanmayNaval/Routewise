import re
from pydantic import BaseModel, Field
from typing import List, Dict, Any
from langchain_core.prompts import ChatPromptTemplate
from app.models.state import TravelState
from app.agents.destination_agent import get_llm

EV_BATTERY_RANGES = {
    "19.2 kWh": 150, "24.0 kWh": 190, "26.0 kWh": 210, "25.0 kWh": 200, "35.0 kWh": 270,
    "30.0 kWh": 220, "40.5 kWh": 290, "45.0 kWh": 330, "55.0 kWh": 400, "65.0 kWh": 450,
    "75.0 kWh": 500, "34.5 kWh": 250, "39.4 kWh": 290, "59.0 kWh": 420, "79.0 kWh": 550,
    "17.3 kWh": 130, "38.0 kWh": 280, "50.3 kWh": 350, "49.0 kWh": 350, "61.0 kWh": 430,
    "39.2 kWh": 300, "72.6 kWh": 500, "~45.0 kWh": 330, "49.92 kWh": 350, "60.48 kWh": 420,
    "55.4 kWh": 400, "71.8 kWh": 500, "61.44 kWh": 450, "82.56 kWh": 580, "77.4 kWh": 500,
    "99.8 kWh": 600, "29.2 kWh": 220
}

class ItineraryOutput(BaseModel):
    day_wise_plan: Dict[str, List[str]] = Field(description="Day-by-day itinerary mapping day numbers to lists of activities. MUST include explicitly named 'EV Charging' stops synced with meals if the user is driving an EV. (e.g., 'Day 1': ['Visit museum', '1:00 PM: Lunch & EV Charge at Highway Plaza', 'Dinner'])")
    ev_charging_strategy: Dict[str, str] = Field(description="If the user is driving an EV, provide a short paragraph per day explaining where and when to charge the vehicle on the route (e.g., 'Day 1': 'Charge at Zeon Fast Charger during lunch at Neemrana'). Else, return empty.")

def itinerary_node(state: TravelState) -> dict:
    llm = get_llm()
    structured_llm = llm.with_structured_output(ItineraryOutput)
    
    system_prompt = "You are an Itinerary Planning Agent. Given a list of destinations and attractions, create a logical day-by-day plan. You must respond in structured JSON format."
    user_prompt = "Create a {days}-day itinerary for {destination_list}. The travel style is {travel_style}. Top attractions available: {attractions}."
    
    if state.get("wants_hotel"):
        system_prompt += " The user wants Hotel Recommendations integrated into the itinerary."
        user_prompt += f" RECALL: The user needs hotel recommendations. They are traveling with {state.get('guests')} guests in {state.get('rooms')} rooms. Check-in is {state.get('check_in_date')} and Check-out is {state.get('check_out_date')}. You MUST explicitly suggest checking into a suitable hotel (within the {state.get('price_per_night')} INR/night range) on the first day, and checking out on the last day."
    
    # Extract route details to get distance and travel time
    route_details = state.get("route_details", {})
    routes = route_details.get("routes", {})
    max_distance = 0
    first_dest_time = ""
    
    if routes:
        first_dest = list(routes.keys())[0]
        first_dest_time = routes[first_dest].get("estimated_time", "Unknown time")
        
        # Calculate max distance to any destination to approximate trip scale
        for dest, info in routes.items():
            dist_str = info.get("distance", "0")
            match = re.search(r'\d+', dist_str)
            if match:
                dist = int(match.group())
                max_distance = max(max_distance, dist)
                
    if state.get("starting_location") and first_dest_time and first_dest_time != "Unknown time":
        user_prompt += f" IMPORTANT TIME CONTEXT: Keep in mind the user is starting from {state.get('starting_location')} and traveling to the first destination. The estimated drive time is {first_dest_time}. YOU MUST explicitly block off this {first_dest_time} period for TRAVEL on Day 1 (and similarly for the return on the last day) before any activities begin."
    
    if state.get("is_ev"):
        ev_string = f"{state.get('ev_brand')} {state.get('ev_model')} ({state.get('ev_battery')} battery)"
        ev_battery = state.get("ev_battery", "")
        ev_range_override = state.get("ev_range", 0)
        
        # If user explicitly entered their real-world range, use it! Otherwise, use the dict estimate.
        if ev_range_override > 0:
             estimated_range = ev_range_override
        else:
             estimated_range = EV_BATTERY_RANGES.get(ev_battery, 250)
        
        system_prompt += f"\n\nCRITICAL DIRECTIVE: The user is driving an Electric Vehicle: {ev_string}."
        
        if max_distance > 0 and max_distance <= (estimated_range * 0.8):
             system_prompt += f" The total driving distance ({max_distance} km) is well within the car's safe range ({estimated_range} km). DO NOT schedule explicit mid-journey charging stops on travel days. Advise the user to charge at their destination or hotel overnight."
             user_prompt += f" RECALL: THE USER IS DRIVING AN EV ({ev_string}). Since the destination is within range ({max_distance} km), DO NOT force charging stops on the road. Just tell them to charge at the hotel."
        else:
             system_prompt += f" The total driving distance ({max_distance} km) may exceed or closely approach the car's safe range ({estimated_range} km). YOU ABSOLUTELY MUST include explicit 'EV Charging Stops' synced with meal breaks (Lunch/Dinner) in the daily itinerary. DO NOT output a standard itinerary without charging segments."
             user_prompt += f" RECALL: THE USER IS DRIVING AN EV ({ev_string}). Explicitly schedule 45-min charging stops intertwined with food breaks on travel days!"

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("user", user_prompt)
    ])
    
    chain = prompt | structured_llm
    
    try:
        response = chain.invoke({
            "days": state.get("days", 1),
            "destination_list": ", ".join(state.get("destinations", [])),
            "travel_style": state.get("travel_style", "relaxed"),
            "attractions": state.get("top_attractions", {})
        })
        
        return {
            "day_wise_plan": response.day_wise_plan,
            "ev_charging_strategy": response.ev_charging_strategy
        }
    except Exception as e:
        print(f"Error in ItineraryAgent: {e}")
        return {
            "day_wise_plan": {
                "Day 1": ["Error generating itinerary. Start exploring!"]
            },
            "ev_charging_strategy": {}
        }
