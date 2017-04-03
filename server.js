var express = require('express')
var app = express()

var port = 8008

var client_id = '04ec33bc2f0544b4b06c9c78c251ff07'; // Your client id
var client_secret = '595fe83b487d4924baef110f240d129b'; // Your secret
var redirect_uri = 'http://localhost:8008/callback'; // Your redirect uri
var auth_url = `https://accounts.spotify.com/authorize/?client_id=${client_id}&response_type=code&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=user-library-read`
// https://accounts.spotify.com/authorize/?client_id=04ec33bc2f0544b4b06c9c78c251ff07&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A8008%2Fcallback&scope=user-library-read


app.get('/', function(req, res) {
    res.redirect(auth_url);
});

app.get('/callback', function(req, res) {
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(port, function () {
  console.log(`Example app listening on port ${port}`)
})
