const express = require('express'); // imports express
const axios = require('axios'); //imports axios

const app = express();

const port = process.env.PORT;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in ms
const CHAMPION_URL = `https://ddragon.leagueoflegends.com/cdn/14.1.1/data/en_US/champion.json`

let cachedChampions = null;
let lastFetchTime = null;


function formatChampionName(champName) {
    let cleanName = champName
            .replaceAll(".", " ")
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join("")
        
            return cleanName
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


app.get('/champion/:name', async (req, res) => {
    try{
        
        const championName = formatChampionName(req.params.name)
        

        console.log(championName)

        const champions = await getChampions(); // calls function
        const champion = champions[championName] // finds specific champion

        if(!champion) {
        return res.status(404).json({error: `Champion not found`})
        }  

        const {name, title, id, blurb} = champion
        const {hp, mp, attackdamage, armor} = champion.stats
        const splashArt = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championName}_0.jpg`

        res.json({
            name,
            id,
            blurb,
            title,
            hp,
            mp,
            armor,
            attackdamage,
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
                const name = champ[0]
                const splashArt = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${name}_0.jpg`
            
            
            return {
                name,
                splashArt
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
        const champName = formatChampionName(req.params.name)


        const url = `https://ddragon.leagueoflegends.com/cdn/14.1.1/data/en_US/champion/${champName}.json`

        const response = await axios.get(url)

        const skinArray = response.data.data[champName].skins
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

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})