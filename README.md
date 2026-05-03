# League of Legends Champion & Summoner Browser

A full stack web application that lets you explore League of Legends champions, 
view their stats, skins, and lore — with summoner profile lookup coming soon.

## 🎮 Features

- Browse all 160+ League of Legends champions
- Search champions in real time
- View detailed champion stats with animated stat bars
- Read full champion lore
- Browse all available skins for each champion
- Smart caching system to minimize API calls
- Rate limiting to protect the API
- Summoner profile lookup (in progress)

## 🛠️ Tech Stack

**Backend**
- Node.js
- Express.js
- Axios
- dotenv
- express-rate-limit

**Frontend**
- HTML
- CSS
- Vanilla JavaScript

**Data**
- Riot Games API
- League of Legends Data Dragon API

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/champions` | Returns all champions with name and sprite |
| GET | `/champion/:name` | Returns detailed champion info, stats and lore |
| GET | `/champion/:name/skins` | Returns all skins for a specific champion |
| GET | `/summoner/:name/:tagLine` | Returns summoner account data and match history |

## 🚀 Getting Started

### Prerequisites
- Node.js
- A Riot Games API Key ([Get one here](https://developer.riotgames.com))

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/lol-champion-browser
cd lol-champion-browser
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root directory
```
PORT=3000
API_KEY=[your-riot-api-key-here]
VERSION=16.9.1
CHAMPION_URL=https://ddragon.leagueoflegends.com/cdn/16.9.1/data/en_US/champion.json
```

4. Start the server
```bash
nodemon .
```

5. Visit `http://localhost:3000` in your browser

## 🗺️ Roadmap

- [ ] Summoner profile page with profile icon and level
- [ ] Summoner rank display
- [ ] Most played champions
- [ ] Champion masteries
- [ ] Match history with champion played and KDA

## ⚠️ Important

Never commit your `.env` file. Your Riot API key should always remain private.

## 👨‍💻 Author

Raphael TA