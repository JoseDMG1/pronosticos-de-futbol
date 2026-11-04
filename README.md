<div align="center">
  <img src="assets/logo.png" alt="Logo" width="140" style="border-radius: 50%;">
  
  <h1 align="center">AI-Powered Football Predictions ⚽</h1>

  <p align="center">
    <strong>A Fully Automated, VIP-style Football Prediction Dashboard driven by advanced Machine Learning.</strong>
    <br />
    <br />
    <a href="https://karidasd.github.io/football-predictions/"><strong>🔴 View Live Dashboard</strong></a>
    ·
    <a href="https://github.com/karidasd/football-predictions/issues">Report Bug</a>
    ·
    <a href="https://github.com/karidasd/football-predictions/issues">Request Feature</a>
  </p>

  <p align="center">
    <img src="https://img.shields.io/github/actions/workflow/status/karidasd/football-predictions/morning_predictions.yml?label=Daily%20Predictions&style=for-the-badge&color=success" alt="Daily Fetch">
    <img src="https://img.shields.io/github/actions/workflow/status/karidasd/football-predictions/evening_results.yml?label=Results%20Tracker&style=for-the-badge&color=blue" alt="Results Tracker">
    <img src="https://img.shields.io/badge/API-Football-orange?style=for-the-badge&logo=api" alt="API-Football">
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
    <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
  </p>
</div>

---

## 🚀 Getting Started Locally

To get a local copy up and running, follow these simple steps.

### Prerequisites
- Python 3.8+
- An API key from [API-Football](https://www.api-football.com/)

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/karidasd/football-predictions.git
   ```
2. Navigate to the project folder
   ```sh
   cd football-predictions
   ```
3. Set your API Key in your environment variables:
   ```sh
   # On Windows (PowerShell)
   $env:API_FOOTBALL_KEY="ENTER_YOUR_API_KEY_HERE"
   
   # On Mac/Linux
   export API_FOOTBALL_KEY="ENTER_YOUR_API_KEY_HERE"
   ```
4. Start the local dashboard. This runs one API refresh and then serves the page. Each restart runs one more refresh while daily API quota remains:
   ```sh
   .\start-local.ps1
   ```
5. Open `http://127.0.0.1:8000` in your browser. Use the status filter to show all matches, only live matches, or only matches that have not started. Stop the server with `Ctrl+C`.

---

## 📝 License

Distributed under the MIT License. This is a project created by karidasd with repository name "football-predictions". Not intended as financial advice.
