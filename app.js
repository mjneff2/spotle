const express = require('express') // Express web server framework
const cors = require('cors')
const axios = require('axios')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json())

const client_id = '8f9a74e7f1e047f5b7bc91dd53752e5d' // Your client id
const client_secret = process.env.CLIENT_SECRET // Your secret
const redirect_uri = 'http://localhost:3000' // Your redirect uri

/*const generateRandomString = (length) => {
    let text = ''
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text
}*/

app.post('/login', async (req, res) => {
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
        try {
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
        } catch (error) {
            console.log(error.response.data)
            res.json({error})
        }
    }
})

app.post('/loggedin', async (req, res) => {
    const access_token = req.body.access_token
    try {
        const result = await axios.get('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': 'Bearer ' + access_token
            }
        })
        return res.json(result.data)
    } catch (error) {
        return res.json(error.response.data)
    }
})

app.get('/callback', async (req, res) => {
    let code = req.query.code
    let state = req.query.state
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
    }
})

app.get('/toptracks', async (req,res) => {
    if (access_token === null) {
        res.redirect('/login')
    }
    const result = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
        params: {
            limit: 50,
            time_range: 'long_term'
        },
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    })
    res.send(result.data)
})

app.listen(8888, () => {
    console.log('Listening on 8888')
})
