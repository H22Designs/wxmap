# Copilot Instructions for wxmap

## Project Overview
wxmap is a Weather Map application. It visualizes weather data on an interactive map interface, allowing users to explore meteorological information geographically.

## Project Structure
- `/` — Repository root; currently contains the README and will grow to include source directories as the project evolves.

## Setting Up
> Update these instructions as the project gains a build system, package manager, and dependencies.

1. Clone the repository:
   ```sh
   git clone https://github.com/H22Designs/wxmap.git
   cd wxmap
   ```
2. Install dependencies (add the appropriate command once a package manager is configured, e.g. `npm install` or `pip install -r requirements.txt`).
3. Run the application (add the start command once defined).
4. Run tests (add the test command once defined).

## Contribution Guidelines
- Open an issue before starting significant work so that changes can be discussed first.
- Keep pull requests focused and small — one feature or bug fix per PR.
- All code changes must pass any configured linting and tests before a PR can be merged.
- Reference the related issue number in PR titles and commit messages where applicable.
- Follow the existing code style and formatting conventions of the project.

## Coding Standards
- Prefer clarity and readability over cleverness.
- Write self-documenting code; add comments only when the intent is not immediately obvious.
- Keep functions and modules small and single-purpose.
- Avoid committing secrets, API keys, or credentials — use environment variables or a `.env` file (never commit `.env`).

## Security
- Never commit secrets, tokens, or credentials to version control.
- Store sensitive configuration in environment variables.
- Validate and sanitize all external data (API responses, user input, URL parameters) before use.

## Special Notes
- Weather data is often sourced from external APIs (e.g. OpenWeatherMap, NOAA). Document any required API keys in `.env.example` but never in `.env` or source files.
- Map rendering may rely on third-party libraries (e.g. Leaflet, Mapbox, Google Maps). Keep these dependencies up to date and document the chosen library once selected.
