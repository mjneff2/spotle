const config = require('./utils/config')
const express = require('express') // Express web server framework
const cors = require('cors')
const axios = require('axios')
const mongoose = require('mongoose')
const middleware = require('./utils/middleware')
const logger = require('./utils/logger')
require('express-async-errors')
const User = require('./models/user')

const app = express()

mongoose.connect(config.MONGODB_URI)
    .then(() => {
        logger.info('connected to MongoDB')
    })
    .catch((error) => {
        logger.error('error connection to MongoDB:', error.message)
    })

app.use(cors())
app.use(express.json())
app.use(middleware.requestLogger)

const client_id = '8f9a74e7f1e047f5b7bc91dd53752e5d' // Your client id
const client_secret = config.CLIENT_SECRET // Your secret
const redirect_uri = 'http://localhost:3000' // Your redirect uri

app.post('/api/login', async (req, res) => {
    const pageUrl = new URL(req.body.pageUrl)
    const params = pageUrl.searchParams
    console.log(params)
    if (!params.has('code')) {
        console.log('no code')
        res.sendStatus(200)
        return
    }
    let code = params.get('code')
    let state = params.get('state')
    console.log(code, state)
    if (state !== null) {
        const result = await axios.post('https://accounts.spotify.com/api/token',
            new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri
            }).toString()
            , {
                headers: {
                    'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
        res.json({
            access_token: result.data.access_token,
            refresh_token: result.data.refresh_token
        })
        const spotifyInfo = await axios.get('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': 'Bearer ' + result.data.access_token
            }
        })
        const existingUser = await User.findById(spotifyInfo.data.id)
        if (!existingUser) {
            const user = new User({
                _id: spotifyInfo.data.id,
                accessToken: result.data.access_token,
                plays: []
            })
            await user.save()
        } else {
            existingUser.accessToken = result.data.access_token
            await existingUser.save()
        }
    }
})

app.post('/api/user', async (req, res) => {
    const access_token = req.body.access_token
    const result = await axios.get('https://api.spotify.com/v1/me', {
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    })
    return res.json(result.data)
})

app.post('/api/track', async (req,res) => {
    const access_token = req.body.access_token
    if (access_token === null) {
        res.sendStatus(401)
    }
    const result = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
        params: {
            limit: 50,
            time_range: 'long_term',
        },
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    })
    const user = await User.findOne({ accessToken: access_token })
    const lastPlay = user.plays.length >= 1 ? user.plays[user.plays.length - 1] : null
    const currentDate = new Date()
    if (lastPlay && lastPlay.time.getDate() === currentDate.getDate()
        && lastPlay.time.getMonth() === currentDate.getMonth()
        && lastPlay.time.getFullYear() === currentDate.getFullYear()) {
        const uri = lastPlay.uri.split(':')[2]
        const trackResult = await axios.get(`https://api.spotify.com/v1/tracks/${uri}`, {
            headers: {
                'Authorization': 'Bearer ' + access_token
            }
        })
        return res.send(trackResult.data)
    }
    const tracks = result.data.items.filter(track => user.plays.find(play => play.uri === track.uri) === undefined)
    console.log(tracks.length)
    const track = tracks[Math.floor(Math.random() * tracks.length)]
    user.plays.push({ time: Date.now(), uri: track.uri })
    await user.save()
    res.send(track)
})

app.post('/api/search', async (req,res) => {
    const query = req.body.query
    const access_token = req.body.access_token
    const result = await axios.get('https://api.spotify.com/v1/search', {
        params: {
            q: query,
            type: 'track',
            access_token
        }
    })
    res.json(result.data)
})

app.use(middleware.unknownEndpoint)
app.use(middleware.errorHandler)

app.listen(config.PORT, () => {
    console.log('Listening on 8888')
})
