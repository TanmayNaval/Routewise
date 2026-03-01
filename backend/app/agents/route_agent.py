import os
import requests
from pydantic import BaseModel, Field
from typing import Dict, Any, List
from langchain_core.prompts import ChatPromptTemplate
from app.models.state import TravelState
from app.agents.destination_agent import get_llm

def geocode_location(address: str) -> tuple:
    """Uses OpenStreetMap Nominatim to get Lon/Lat coordinates."""
    try:
        url = f"https://nominatim.openstreetmap.org/search?q={address}&format=json&limit=1"
        headers = {'User-Agent': 'EasyTripPlanner-AI/1.0'}
        response = requests.get(url, headers=headers).json()
        if response and len(response) > 0:
            return float(response[0]['lon']), float(response[0]['lat'])
    except Exception as e:
        print(f"Geocoding error for {address}: {e}")
    return None, None

def get_osrm_route(lon1: float, lat1: float, lon2: float, lat2: float) -> tuple:
    """Uses OSRM to get driving distance and duration between two coordinates."""
    try:
        url = f"http://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false"
        response = requests.get(url).json()
        if response.get("code") == "Ok" and response.get("routes"):
            route = response["routes"][0]
            distance_km = round(route["distance"] / 1000, 1) # Convert meters to km
            duration_mins = round(route["duration"] / 60) # Convert seconds to mins
            
            hours = duration_mins // 60
            mins = duration_mins % 60
            time_str = f"{hours} hours {mins} mins" if hours > 0 else f"{mins} mins"
            
            return f"{distance_km} km", time_str
    except Exception as e:
        print(f"OSRM Routing error: {e}")
    return None, None

class RouteInfo(BaseModel):
    destination: str = Field(description="Name of the destination city or place this route leads to")
    distance: str = Field(description="Estimated distance (e.g., '250 km')")
    estimated_time: str = Field(description="Estimated travel time (e.g., '5 hours 30 mins')")
    road_conditions: str = Field(description="Description of road conditions (e.g., 'Mostly smooth highways, last 20km rough patches')")
    route_advice: str = Field(description="Advice on routes, including EV charging strategy if applicable (e.g., 'Take Highway 44, stop for a 45-min fast charge at Zeon Charging Station')")
    recommended_stops: List[str] = Field(description="List of recommended pit stops, meal breaks, or specific EV Fast Charging stations")

class RouteOutput(BaseModel):
    routes: List[RouteInfo] = Field(description="List of routes mapped to each destination from the starting location", default_factory=list)
    summary: str = Field(description="Overall summary of the road trip or travel plan")

def route_node(state: TravelState) -> dict:
    travel_mode = state.get("travel_mode", "").lower()
    # Only run the complex route analysis if traveling by car/bike
    if travel_mode not in ["car", "bike"]:
        return {"route_details": {}}
        
    llm = get_llm()
    structured_llm = llm.with_structured_output(RouteOutput)
    
    system_prompt = "You are a Road Trip Route Planning Agent catering to Indian travelers. Given a starting location and a list of destinations, analyze the route for a {travel_mode} trip. Provide detailed information about road conditions, estimating which roads are good or bad, shortcuts vs comfortable roads, estimated travel time, and distance. Respond in structured JSON format."
    
    if state.get("is_ev"):
        ev_string = f"{state.get('ev_brand')} {state.get('ev_model')} ({state.get('ev_battery')} battery)"
        system_prompt += f"\n\nIMPORTANT EV DRIVING REQUREMENTS:\nThe user is driving an Electric Vehicle: {ev_string}. When listing recommended pit stops, you MUST prioritize locations with fast-charging infrastructure (e.g., Zeon, Tata Power, Jio-bp, ChargeZone). Warn the user about stretches with no chargers if applicable."

        destination_list = state.get("destinations", [])
        starting_location = state.get("starting_location")
        
        # 1. Fetch exact real-world data from OSRM API (Free)
        exact_route_context = ""
        
        if starting_location and destination_list:
            start_lon, start_lat = geocode_location(starting_location)
            
            if start_lon and start_lat:
                exact_route_context = "\n\nCRITICAL OSRM MAPPING DATA:\nYou MUST use the following exact real-world distances and times in your response. Do not hallucinate distances or travel times.\n"
                
                for dest in destination_list:
                    dest_lon, dest_lat = geocode_location(dest)
                    if dest_lon and dest_lat:
                        dist, duration = get_osrm_route(start_lon, start_lat, dest_lon, dest_lat)
                        if dist and duration:
                            exact_route_context += f"- {starting_location} to {dest}: {dist}, {duration} driving time.\n"
        
        system_prompt += exact_route_context
        
        # 2. Re-create the prompt with the new context
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", "Starting Location: {starting_location}. Destinations: {destination_list}. Travel Mode: {travel_mode}. Analyze the road trip route.")
        ])
        
        chain = prompt | structured_llm

        # 3. Invoke LLM
    else:
        # Code path for non-EV trips or plane/train trips!
        system_prompt = "You are a Road Trip Route Planning Agent catering to Indian travelers. Given a starting location and a list of destinations, analyze the route for a {travel_mode} trip. Provide detailed information about road conditions, estimating which roads are good or bad, shortcuts vs comfortable roads, estimated travel time, and distance. Respond in structured JSON format."
        user_prompt = "Starting Location: {starting_location}. Destinations: {destination_list}. Travel Mode: {travel_mode}. Analyze the road trip route."
            
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", user_prompt)
        ])
        chain = prompt | structured_llm

    try:
        response = chain.invoke({
            "starting_location": state.get("starting_location"),
            "destination_list": ", ".join(state.get("destinations", [])),
            "travel_mode": travel_mode
        })
        
        # Convert Pydantic objects to dicts for the state
        routes_dict = {
            info.destination: {
                "distance": info.distance,
                "estimated_time": info.estimated_time,
                "road_conditions": info.road_conditions,
                "route_advice": info.route_advice,
                "recommended_stops": info.recommended_stops
            } for info in response.routes
        }
        
        return {
            "route_details": {
                "routes": routes_dict,
                "summary": response.summary
            }
        }
    except Exception as e:
        print(f"Error in RouteAgent: {e}")
        return {
            "route_details": {
                "summary": "Could not fetch detailed route information due to an error.",
                "routes": {}
            }
        }
