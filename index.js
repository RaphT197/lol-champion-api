const dotenv = require('dotenv'); // imports dotenv
dotenv.config(); // loads environment variables from .env file

const express = require('express'); // imports express
const rateLimit = require('express-rate-limit'); // imports express-rate-limit
const axios = require('axios'); //imports axios
const path = require('path');

const envport = process.env.PORT || 3000; // sets the port to the value of the PORT environment variable, or defaults to 3000 if not set

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    validate: { trustProxy: false, xForwardedForHeader: false }
});

const app = express();
app.set('trust proxy', 1);
app.use(limiter); // applies rate limiting to all routes
app.set('trust proxy', 1);
app.use(express.static(path.join(__dirname, 'public')))

const CACHE_DURATION = process.env.CACHE_DURATION || 60 * 60 * 1000; // 1 hour in ms
const CHAMPION_URL = process.env.CHAMPION_URL || `https://ddragon.leagueoflegends.com/cdn/14.1.1/data/en_US/champion.json`
const API_KEY = process.env.API_KEY

let cachedLore = {};
let cachedChampions = null;
let lastFetchTime = null;
let timeStamp = null;


      

function formatChampionName(champName) {
    let cleanName = champName
            .replaceAll(".", " ")
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
            return cleanName
}

async function getSummonerData (summonerName, tagLine) {

    const url = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${summonerName}/${tagLine}`

    const response = await axios.get(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Charset": "application/x-www-form-urlencoded; charset=UTF-8",
            "Origin": "https://developer.riotgames.com",
            "X-Riot-Token": process.env.API_KEY
        }
    })

    console.log(response.data)
    return response.data
}
async function getChampions() {
    
    const cacheExpired = lastFetchTime &&
        (Date.now() - lastFetchTime > CACHE_DURATION)

    if(!cachedChampions || cacheExpired){
        const response = await axios.get(CHAMPION_URL)
        cachedChampions = response.data.data
        lastFetchTime = Date.now()
        return cachedChampions
    } else {
        console.log("Using cached data")
        return cachedChampions;
    }

}

async function getMatchIds(puuid) {
    const url = `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20`

    const response = await axios.get(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Charset": "application/x-www-form-urlencoded; charset=UTF-8",
            "Origin": "https://developer.riotgames.com",
            "X-Riot-Token": API_KEY
        }
    })
    return response.data
}


app.get(`/summoner/:name/:tagLine`, async (req, res) => {
    try {
        const summonerName = req.params.name
        const tagLine = req.params.tagLine

        const summonerData = await getSummonerData(summonerName, tagLine)
        const matchIds = await getMatchIds(summonerData.puuid)
        const summonerGameName = summonerData.gameName + '#' + summonerData.tagLine
        console.log(summonerGameName)


        res.json({
            summonerData,
            matchIds,
            summonerGameName
        })

    } catch (error) {
        console.error(error.message);

        if(error.response && error.response.status === 404){
            res.status(404).json({error: `Summoner not found`})
        } else {
            res.status(500).json({error: `Something went wrong.`})
        }
    }
}) 


app.get('/champion/:name', async (req, res) => {
    try{
        const championName = req.params.name
        const loreCache = cachedLore[championName]

        const loreCacheExpired = loreCache &&
            (Date.now() - loreCache.timeStamp > CACHE_DURATION)

        if (!loreCache || loreCacheExpired) {
            const detailUrl = `https://ddragon.leagueoflegends.com/cdn/${process.env.VERSION}/data/en_US/champion/${championName}.json`
            const detailResponse = await axios.get(detailUrl)
            cachedLore[championName] = {
                data: detailResponse.data.data[championName],
                timeStamp: Date.now()
            }

        }

        const champions = await getChampions(); // calls function
        const champion = champions[championName] // finds specific champion

        if(!champion) {
        return res.status(404).json({error: `Champion not found`})
        }  


        const {name, title, id} = champion
        const {lore} = cachedLore[championName].data
        const {hp, mp, movespeed, armor, spellblock, attackrange, attackdamage, attackspeed} = champion.stats
        const splashArt = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championName}_0.jpg`


        res.json({
            name,
            id,
            lore,
            title,
            hp, 
            mp, 
            movespeed, 
            armor, 
            spellblock, 
            attackrange, 
            attackdamage, 
            attackspeed,
            splashArt
        })

    } catch (error) {
        console.error(error.message);

        if(error.response && error.response.status === 404){
            res.status(404).json({error: `Champion not found`})
        } else {
            res.status(500).json({error: `Something went wrong.`})
        }
        
    }
});

app.get('/champions', async (req, res) => {
    try {

        const champions = await getChampions()

        const championList = Object.entries(champions)
            .map(champ => {
                const id = champ[0]
                const data = champ[1]
                const name = data.name
                const sprite = `https://ddragon.leagueoflegends.com/cdn/${process.env.VERSION}/img/champion/${id}.png`
                //`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_0.jpg`
            
            return {
                id,
                name,
                sprite
            }
    })

        res.json(championList)

    }   catch (error) {
        console.error(error.message);

        if(error.response && error.response.status === 404){
            res.status(404).json({error: `Champion not found`})
        } else {
            res.status(500).json({error: `Something went wrong.`})
        }
        
    }
})


app.get('/champion/:name/skins', async (req,res) => {
    try{
        const champName = req.params.name

        const url = `https://ddragon.leagueoflegends.com/cdn/${process.env.VERSION}/data/en_US/champion/${champName}.json`

        const response = await axios.get(url)

        const skinArray = response.data.data[champName].skins
            .filter(skin => !skin.parentSkin)
            .map(skins => {
                const skinNumber = skins.num
                const skinName = skins.name
                const skinURL = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champName}_${skinNumber}.jpg`
            
            return {
                skinNumber,
                skinName,
                skinURL
            }
            })

        res.json(skinArray)

    } catch(error) { console.error(error.message);

        if(error.response && error.response.status === 404){
            res.status(404).json({error: `Champion not found`})
        } else {
            res.status(500).json({error: `Something went wrong.`})
        }
    }
}) 

app.get('/lol/summoner/v4/summoners/by-puuid/:puuid', async (req, res) => {
    try {
        const puuid = req.params.puuid;

        const url = `https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;

        const response = await axios.get(url, {
            headers: {
                'X-Riot-Token': process.env.API_KEY
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error(error.message);

        if(error.response && error.response.status === 404){
            res.status(404).json({error: `Summoner not found`})
        } else {
            res.status(500).json({error: `Something went wrong.`})
        }
    }
});

app.get('/lol/match/v5/matches/:matchId', async (req, res) => {
    try {
        const matchId = req.params.matchId;

        const url = `https://americas.api.riotgames.com/lol/match/v5/matches/${matchId}`;

        const response = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Charset": "application/x-www-form-urlencoded; charset=UTF-8",
                "Origin": "https://developer.riotgames.com",
                "X-Riot-Token": API_KEY
            }
        });



        res.json(response.data);
    } catch (error) {
        console.error(error.message);

        if(error.response && error.response.status === 404){
            res.status(404).json({error: `Match not found`})
        } else {
            res.status(500).json({error: `Something went wrong.`})
        }
    }
})

module.exports = app;

//commented it out to host on vercel
// app.listen(envport, () => {
//     console.log(`Server is running on port ${envport}`)
// })