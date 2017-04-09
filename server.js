var express = require('express')
var app = express()

var port = 8008

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.get('/spotify-analyzer', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.get('/callback', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});



app.listen(port, function () {
  console.log(`Example app listening on port ${port}`)
})
