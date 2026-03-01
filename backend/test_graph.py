import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

from app.graph.travel_graph import build_travel_graph

travel_graph = build_travel_graph()

initial_state = {
    "destination": "Jaipur",
    "days": 2,
    "budget": "medium",
    "travel_style": "adventure",
    "trip_type": "national",
    "starting_location": "Delhi",
    "travel_mode": "car",
    "specific_locations": "",
    "is_ev": True,
    "ev_brand": "Tata Motors",
    "ev_model": "Nexon EV",
    "ev_battery": "40.5 kWh",
    "destinations": [],
    "top_attractions": {},
    "reasoning": "",
    "day_wise_plan": {},
    "ev_charging_strategy": {},
    "route_details": {},
    "estimated_budget": {},
    "budget_tips": []
}

res = travel_graph.invoke(initial_state)
print("KEYS IN RESP:", res.keys())
if "ev_charging_strategy" in res:
    print("EV CHARGING:", res["ev_charging_strategy"])
else:
    print("MISSING EV CHARGING")
