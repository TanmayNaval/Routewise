# Multi-Agent AI Travel Planner using LangGraph

An end-to-end AI project demonstrating multi-agent orchestration via **LangGraph**, **FastAPI**, and modern frontend design with **Tailwind CSS**. The system coordinates specialized AI agents to generate structured, personalized travel itineraries and budget estimations.

## Features

- **Multi-Agent Collaboration**: Three specialized AI agents work together in a LangGraph state graph.
  1. `DestinationAgent`: Chooses best spots and attractions based on generic queries.
  2. `ItineraryAgent`: Plans a logical day-by-day sequence.
  3. `BudgetAgent`: Calculates estimated costs in USD and provides money-saving tips.
- **Structured LLM Output**: All agents force strict JSON schemas using Pydantic, making data incredibly reliable.
- **Modern User Interface**: A responsive TailwindCSS Vanilla HTML/JS frontend that connects seamlessly to the FastAPI backend.
- **Graceful Error Handling**: If one agent fails, the pipeline uses fallback responses to prevent total failure.

## Getting Started

### Prerequisites

- Python 3.10+
- OpenAI API Key (or Google GenAI / Groq if you switch the LLM logic)
- A modern web browser

### Backend Setup

1. Open your terminal and navigate to the `backend` directory:
   ```bash
   cd travel-planner-ai/backend
   ```
2. Create and activate a Virtual Environment (Recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install Dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set Environment Variables:
   - Rename `.env.example` to `.env`
   - Add your API Key: `OPENAI_API_KEY=sk-...`
5. Run the server:
   ```bash
   uvicorn app.main:app --reload
   ```
   The backend will be running at `http://localhost:8000`.

### Frontend Setup

1. The frontend requires zero build steps!
2. Simply open `travel-planner-ai/frontend/index.html` in your web browser.
   - E.g. right-click -> Open With -> Google Chrome, or run a simple local server in the `frontend` directory: `python -m http.server 8080`.

## API Usage

### `POST /api/plan-trip`

**Request Body:**
```json
{
  "destination": "Italy",
  "days": 5,
  "budget": "medium",
  "travel_style": "relaxed"
}
```

**Response:**
Returns the complete `TravelState` dictionary containing all outputs from the `DestinationAgent`, `ItineraryAgent`, and `BudgetAgent`.

## Project Structure
- `backend/app/agents/`: LLM definitions with Pydantic structured output models.
- `backend/app/graph/`: LangGraph orchestration edges and nodes.
- `backend/app/models/`: Shared state definitions.
- `frontend/`: The User Interface.
