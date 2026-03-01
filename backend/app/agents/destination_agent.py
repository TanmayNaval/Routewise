import os
import json
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from typing import List, Dict, Any
from app.models.state import TravelState

class DestinationOutput(BaseModel):
    destinations: List[str] = Field(description="List of suggested destinations")
    top_attractions: Dict[str, List[str]] = Field(description="Top attractions for each destination")
    recommended_hotels: Dict[str, List[str]] = Field(description="If the user wants a hotel, provide 2-3 recommended hotels for each destination matching their price range (include a short description like 'Name - Brief details'). Else leave empty.", default_factory=dict)
    reasoning: str = Field(description="Reasoning for the selection")

def get_llm():
    provider = os.getenv("LLM_PROVIDER", "openai").lower()
    if provider == "gemini":
        return ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.7)
    elif provider == "groq":
        return ChatGroq(model="llama-3.3-70b-versatile", temperature=0.7)
    # Default to OpenAI
    return ChatOpenAI(model="gpt-3.5-turbo", temperature=0.7)

def destination_node(state: TravelState) -> dict:
    llm = get_llm()
    structured_llm = llm.with_structured_output(DestinationOutput)
    
    system_prompt = "You are a specialized Travel Destination Agent catering specifically to Indian travelers. Your job is to suggest the best destinations based on user preferences. Keep in mind Visa requirements and flight connectivity from India if it's an international trip. If a starting location and travel mode are provided, ensure the destinations are reachable via that mode from the starting location. If the user provides specific locations they already want to visit, you MUST factor them into your suggestions heavily while filling in gaps or suggesting nearby complementary attractions. You must respond in structured JSON format."
    user_prompt = "Suggest destinations for a {trip_type} trip to {destination} for {days} days. Specific cities/locations they already have in mind: {specific_locations}. Budget: {budget}, Travel Style: {travel_style}. Starting Location: {starting_location}, Preferred Travel Mode: {travel_mode}."
    
    if state.get("wants_hotel"):
        system_prompt += " The user also requested hotel recommendations. You MUST include a list of 2-3 specific real-world hotels for each destination that fit within the specified price per night range."
        user_prompt += f" RECALL: The user needs hotel suggestions. They require {state.get('rooms')} rooms for {state.get('guests')} guests. The price per night MUST be roughly within the {state.get('price_per_night')} INR range. Populate the 'recommended_hotels' field!"
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("user", user_prompt)
    ])
    
    chain = prompt | structured_llm
    
    try:
        response = chain.invoke({
            "destination": state["destination"],
            "days": state["days"],
            "budget": state["budget"],
            "travel_style": state["travel_style"],
            "trip_type": state.get("trip_type", "national"),
            "starting_location": state.get("starting_location", "Not specified"),
            "travel_mode": state.get("travel_mode", "Not specified"),
            "specific_locations": state.get("specific_locations", "None specified")
        })
        
        return {
            "destinations": response.destinations,
            "top_attractions": response.top_attractions,
            "recommended_hotels": response.recommended_hotels,
            "reasoning": response.reasoning
        }
    except Exception as e:
        print(f"Error in DestinationAgent: {e}")
        return {
            "destinations": [state["destination"]],
            "top_attractions": {},
            "recommended_hotels": {},
            "reasoning": "Fallback reasoning due to error."
        }
