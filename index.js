const dotenv = require('dotenv'); // imports dotenv
dotenv.config(); // loads environment variables from .env file

const CACHE_DURATION = process.env.CACHE_DURATION || 60 * 60 * 1000; // 1 hour in ms
const CHAMPION_URL = process.env.CHAMPION_URL || `https://ddragon.leagueoflegends.com/cdn/14.1.1/data/en_US/champion.json`
const API_KEY = process.env.API_KEY
const express = require('express'); // imports express
const rateLimit = require('express-rate-limit'); // imports express-rate-limit
const axios = require('axios'); //imports axios
const path = require('path');
const { match } = require('assert');

const HEADER = {
    
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Charset": "application/x-www-form-urlencoded; charset=UTF-8",
    "Origin": "https://developer.riotgames.com",
    "X-Riot-Token": API_KEY
}

const envport = process.env.PORT || 3000; // sets the port to the value of the PORT environment variable, or defaults to 3000 if not set

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    validate: { trustProxy: false, xForwardedForHeader: false }
});

const app = express();
app.use(express.static(path.join(__dirname, 'public')))
app.use( '/resources',express.static(path.join(__dirname, 'resources')))
app.use(limiter); // applies rate limiting to all routes
app.set('trust proxy', 1);


let cachedLore = {};
let skinCached = {};
let matchCached = {};
let cachedChampions = null;
let lastFetchTime = null;
let timeStamp = null;



async function getSummonerData (summonerName, tagLine) {

    const url = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${summonerName}/${tagLine}`

    const response = await axios.get(url, {
        headers: HEADER
    })

    //console.log(response.data)
    return response.data
}

async function getMatchDetails(matchId) {
    const matchCache = matchCached[matchId]
    
    const matchCacheExpired = matchCache &&
        (Date.now() - matchCache.timeStamp > CACHE_DURATION)

    if (!matchCache || matchCacheExpired) {
        const url = `https://americas.api.riotgames.com/lol/match/v5/matches/${matchId}`
        const response = await axios.get(url, { headers: HEADER })
        matchCached[matchId] = {
            data: response.data,
            timeStamp: Date.now()
        }
        console.log(`Fetched fresh match: ${matchId}`)
    } else {
        console.log(`Using cached match: ${matchId}`)
    }

    const data =  matchCached[matchId].data
    console.log(data)
    return data
}

async function getChampionMastery (puuid) {
    const championMastURL = `https://na1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`

    const response = await axios.get(championMastURL, {
        headers: HEADER
    })

    return response.data
}

async function getChampionWinRate(puuid, matchIds) {
    const championStats = {}

    for (const matchId of matchIds) {
        const match = await getMatchDetails(matchId)

        const player = match.info.participants
            .find(p => p.puuid === puuid)

        if(!player) continue

        const won = player.win

        const champion = player.championName

        if (!championStats[champion]) {
            championStats[champion] = { wins: 0, losses: 0, games: 0 }
        }

        championStats[champion].games++
        if (won) championStats[champion].wins++
        if (!won) championStats[champion].losses++

    }

    return Object.entries(championStats)
        .map(([champion, stats]) => ({
            champion,
            games: stats.games,
            wins: stats.wins,
            losses: stats.losses,
            winRate: ((stats.wins / stats.games) * 100).toFixed(1)
        }))
        .sort((a, b) => b.winRate - a.winRate)

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
        //console.log("Using cached data")
        return cachedChampions;
    }

}

async function getMatchIds(puuid) {
    const url = `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20`

    const response = await axios.get(url, {
        headers: HEADER
    })
    return response.data
}

async function getRankData(puuid) {
    const rankUrl = `https://na1.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`
    const rankResponse = await axios.get(rankUrl, {
        headers: HEADER
    })

    return rankResponse.data
}

app.get(`/summoner/:name/:tagLine`, async (req, res) => {
    try {
        const summonerName = req.params.name
        const tagLine = req.params.tagLine
        const summonerData = await getSummonerData(summonerName, tagLine)
        //console.log(summonerData)
        const matchIds = await getMatchIds(summonerData.puuid)
        const puuid = summonerData.puuid
        const allMatchInfo = await Promise.all(matchIds.map(matches => getMatchDetails(matches)))
        let champMasteryData = await getChampionMastery(puuid)
        champMasteryData = champMasteryData.slice(0,3)
        const championWinRate = await getChampionWinRate(puuid, matchIds)
        const summonerGameName = summonerData.gameName + '#' + summonerData.tagLine
        const rankData = await getRankData(puuid)
        const rankInfo = rankData.map(info => 
            ({
                queueType: info.queueType,
                tier: info.tier,
                rank: info.rank,
                leaguePoints: info.leaguePoints,
                wins: info.wins,
                losses: info.losses
            }))
        

        //console.log(summonerGameName)

        const combinedData = [...[summonerData],...[matchIds], ...[summonerGameName], ...[rankInfo], ...[champMasteryData], championWinRate, ...[allMatchInfo]]


        res.json(combinedData)

        // res.json({
        //     summonerData,
        //     matchIds,
        //     summonerGameName,
        //     rankInfo
        // })

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
        //console.log(champions)
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
                let key = champ[1].key
                const data = champ[1]
                const name = data.name
                const sprite = `https://ddragon.leagueoflegends.com/cdn/${process.env.VERSION}/img/champion/${id}.png`
                //`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_0.jpg`
            
            return {
                id,
                key,
                name,
                sprite
            }
    })

        championList.sort((a, b) => a.name.localeCompare(b.name));
        //console.log(championList)
        //res.json(champName2Key)
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
        const skinCache = skinCached[champName]

        const skinCacheExpired = skinCache &&
            (Date.now() - skinCache.timeStamp > CACHE_DURATION)

        if (!skinCache || skinCacheExpired) {
            const detailUrl = `https://ddragon.leagueoflegends.com/cdn/${process.env.VERSION}/data/en_US/champion/${champName}.json`
            const response = await axios.get(detailUrl)
            const skinArray = response.data.data[champName].skins
            skinCached[champName] = {
                data: skinArray,
                timeStamp: Date.now()
                }
            }
    

        const skinArray = skinCached[champName].data
            .filter(skin => !skin.parentSkin)
            .map(skins => {
                const skinNumber = skins.num
                const skinName = skins.name
                const skinURL = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champName}_${skinNumber}.jpg`

                return {
                    skinName,
                    skinNumber,
                    skinURL
                }
            })

        res.json(skinArray)

        } catch(error) {
        console.error(error.message);

        if(error.response && error.response.status === 404){
            res.status(404).json({error: `Champion not found`})
        } else {
            res.status(500).json({error: `Something went wrong.`})
        }
    }
    
}); 

app.get('/lol/summoner/v4/summoners/by-puuid/:puuid', async (req, res) => {
    try {
        const puuid = req.params.puuid;

        const url = `https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;

        const response = await axios.get(url, {
            headers: HEADER
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


module.exports = app;

if (require.main === module) {
    app.listen(envport, () => {
        console.log(`Server is running on port ${envport}`)
    })
}