
var version = "v0.2.9"
console.log(version);
document.getElementById("version").innerHTML = version

var spotify_client_id = '04ec33bc2f0544b4b06c9c78c251ff07'; // Your client id (meh)
var redirect_uri = location.origin+location.pathname

var auth_url = `https://accounts.spotify.com/authorize?client_id=${spotify_client_id}&response_type=token&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=user-library-read%20user-read-private%20user-read-email`

var access_token = null
var refresh_token = null

var spotify_client_id = null

var lastfm_api_key = "b25b959554ed76058ac220b7b2e0a026"

var playlistObjects = []

var currentPlaylist = ""
var songs = []
var requestedSongs = []
var songsWithTags = 0
var songTags = 0
var lastFMProcessIndex = 0
var timer = null

var genreDemographics = {}
var chartsCreated = false
var chartTitle = ""
var chartTitleObject = {}

var GETRequestConfig = null

if (location.hash != "") {
    authenticate(spotify_client_id, redirect_uri, ready)
    window.history.pushState('page2', 'Title', location.pathname);
} else {
    document.getElementById("login").href = auth_url
}

function ready() {
    console.log("ready");
    document.getElementById("input").style.visibility = "visible"
    document.getElementById("login").style.visibility = "hidden"

    // Set generic request headers
    var headers = new Headers()
    headers.append('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8')
    headers.append('Authorization', "Bearer " + access_token)

    GETRequestConfig = {
        method: 'GET',
        headers: headers,
        mode: 'cors',
        cache: 'default'
    }

    // Set username
    var userEndpoint = "https://api.spotify.com/v1/me"

    fetch(userEndpoint, GETRequestConfig)
    .then((blob) => blob.json())
    .then((data) => {
        spotify_client_id = data.id
        document.getElementById("userLibrary").value = JSON.stringify({href: "https://api.spotify.com/v1/me", title: "saved tracks", owner: spotify_client_id})
        getPlaylists()
    })

    // Get playlists
    function getPlaylists() {
        var playlistsEndpoint = `https://api.spotify.com/v1/users/${spotify_client_id}/playlists`

        function handlePlaylistResponse(data) {
            data.items.map(item => {
                var value = JSON.stringify({href: item.href, title: encodeURIComponent(item.name.replace("'", "")), owner: item.owner.id})
                document.getElementById("userPlaylists").innerHTML += `
                <option value='${value}'>${item.name}</option>
                `
            })
        }

        fetch(playlistsEndpoint, GETRequestConfig)
        .then(blob=>blob.json())
        .then(data=>{
            handlePlaylistResponse(data)
            recursiveGet(data, playlistsEndpoint, GETRequestConfig, 1, 20, handlePlaylistResponse, maxRequests=null, callback=()=>{
                // Got playlists - enable source select
                document.getElementById("sourceSelect").disabled = false
                document.getElementById("confirmSource").disabled = false

                // Click listener
                document.getElementById("confirmSource").addEventListener("click", ()=>{
                    document.getElementById("statusContainer").style.visibility = "visible"
                    var value = document.getElementById("sourceSelect").value
                    var endpoint = ""
                    if (value != "playlistURLOption") {
                        value = JSON.parse(document.getElementById("sourceSelect").value)
                        endpoint = value.href + "/tracks"
                        chartTitle = `Top genres for ${decodeURIComponent(value.title)} (${value.owner}) on ${printDate()}`
                        chartTitleObject = value
                        if (currentPlaylist != endpoint) {
                            populateSongs(endpoint)
                        }
                    } else {
                        // process text field and generate endpoint
                        endpoint = parsePlaylistInput(document.getElementById("playlistURL").value)
                        if (endpoint === "__!__Invalid link__!_#") {
                            alert("Invalid playlist link")
                        } else if (currentPlaylist != endpoint) {
                            fetch(endpoint, GETRequestConfig)
                            .then(blob => blob.json())
                            .then(data => {
                                chartTitle = `Top genres for ${decodeURIComponent(data.name)} (${data.owner.id}) on ${printDate()}`
                                chartTitleObject = value
                                populateSongs(endpoint + "/tracks")
                            })
                        }
                    }
                })
                document.getElementById("sourceSelect").addEventListener("change", ()=> {
                    // add listener to check if "Playlist URL" option is selected
                    // enable/disable text field
                    value = document.getElementById("sourceSelect").value
                    if (value === "playlistURLOption") {

                        document.getElementById("playlistURLContainer").innerHTML = `
                        <input id="playlistURL" type="text" style="margin-top:10px;width:300px" placeholder="Playlist link/ID">
                        `
                    } else {
                        document.getElementById("playlistURLContainer").innerHTML = ``
                    }
                })
            })
        })
    }
}

function parsePlaylistInput(input) {
    var result = (input + "/").split("/")
    console.log(result);
    var i = result.length-1
    var tmp = result[i]
    for (var i = result.length-1; i > -1; i--) {
        tmp = result[i]
        if (tmp.length === 22) {
            return `https://api.spotify.com/v1/users/${spotify_client_id}/playlists/${tmp}`
        }
    }
    return "__!__Invalid link__!_#"
}

function authenticate(spotify_client_id, redirect_uri, callback) {
    function gup(name, url) {
        if (!url) url = location.href;
        name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]")
        var regexS = "[\\?&]"+name+"=([^&#]*)"
        var regex = new RegExp( regexS )
        var results = regex.exec( url )
        return results == null ? null : results[1]
    }

    if (!(gup("error"))) {
        access_token = `${location.hash}`.substring(location.hash.indexOf("=")+1, location.hash.indexOf("&"))
        callback(access_token)
    } else {
        console.error("Error");
    }
}

function populateSongs(endpoint) {
    currentPlaylist = endpoint
    document.getElementById("charts").style.visibility = "hidden"
    document.getElementById("totalLookedUp").innerHTML = 0

    // Reinitialize variables
    songs = []
    requestedSongs = []
    songsWithTags = 0
    songTags = 0
    lastFMProcessIndex = 0
    timer = null

    genreDemographics = {}
    chartsCreated = false

    var requestsMade = 0
    var limit = 50

    fetch(endpoint + `?limit=${limit}&offset=${requestsMade * limit}`, GETRequestConfig)
    .then((blob) => blob.json())
    .then((data) => {
        data.items.map(item => {
            songs.push({title: item.track.name, artist: item.track.artists[0].name})
        })
        getTagsForSongs()
        updateSongCount(data.items)
        recursiveGet(data, endpoint, GETRequestConfig, requestsMade+1, limit, data => {
            data.items.map(item => {
                songs.push({title: item.track.name, artist: item.track.artists[0].name})
            })
            updateSongCount(data.items)
        })
    })
}

function recursiveGet(responseData, endpoint, request, requestsMade, limit, action=()=>{}, maxRequests=null, callback=()=>{}) {
    if (maxRequests !== null) {
        if (requestsMade > maxRequests) {
            callback()
            return
        }
    }
    if (!(responseData.items.length < limit)) {
        fetch(endpoint + `?limit=${limit}&offset=${requestsMade * limit}`, request)
        .then((blob) => blob.json())
        .then((data) => {
            action(data)
            recursiveGet(data, endpoint, request, requestsMade+1, limit, action, maxRequests, callback)
        })
    } else {
        callback()
    }
}

function getTagsForSongs() {
    console.warn("Getting tags");
    timer = window.setInterval(getSongTags, 200) // Last.fm limits requests to 5 per second per IP
}

function getSongTags() {
    if (lastFMProcessIndex < songs.length) {
        var title = songs[lastFMProcessIndex].title
        var artist = songs[lastFMProcessIndex].artist
        var endpoint = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${lastfm_api_key}`
        var params = `&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}`
        var appendix = "&user=RJ&format=json"
        fetch(endpoint + params + appendix)
        .then(blob => blob.json())
        .then(data => {
            tags =  data.track.toptags.tag
            songsWithTags++
            tags.map(tag => {
                item = tag.name
                if (lastFMProcessIndex < songs.length) {
                    songTags++
                    if (genreDemographics[item]) {
                        genreDemographics[item]["count"] += 1
                        genreDemographics[item]["tracks"].push(songs[lastFMProcessIndex])
                    } else {
                        genreDemographics[item] = {}
                        genreDemographics[item]["count"] = 1
                        genreDemographics[item]["tracks"] = [songs[lastFMProcessIndex]]
                    }
                }
            })
            requestedSongs.push({title: title, artist: artist, tags: tags})
            document.getElementById("totalLookedUp").innerHTML = lastFMProcessIndex
            document.getElementById("eta").innerHTML = 200 * (songs.length - lastFMProcessIndex) / 1000
            document.getElementById("current").innerHTML = title + " - " + artist
        })
        lastFMProcessIndex += 1
    } else if (!chartsCreated){
        window.clearInterval(timer)
        document.getElementById("fetchStatus").innerHTML = "Done."
        analyzeSongs()
        chartsCreated = true
    }

}

function analyzeSongs() {
    console.log("Analyzing");
    // console.log(genreDemographics);
    var keysSorted = Object.keys(genreDemographics).sort(function(b,a){return genreDemographics[a].count-genreDemographics[b].count})
    var tabulated = []
    for (var i = 0; i < keysSorted.length; i++) {
        // console.log(genreDemographics[keysSorted[i]].tracks);
        tabulated.push([keysSorted[i], genreDemographics[keysSorted[i]].count, genreDemographics[keysSorted[i]].tracks])
    }
    console.table(tabulated)
    document.getElementById("feedback").innerHTML = `Found ${songTags} tags for ${songsWithTags} songs.`
    document.getElementById("charts").style.visibility = "visible"
    document.getElementById("currentContainer").style.visibility = "hidden"

    // Charts
    var labels = []
    var data = []
    for (var i = 0; i < 7; i++) {
        labels.push(tabulated[i][0])
        data.push(tabulated[i][1])
    }
    Chart.defaults.global.responsive = false

    // Create new element because reuse of element reponds inappopriately
    document.getElementById("chartContainer").innerHTML = `
    <canvas id="${encodeURIComponent(chartTitleObject.title)}" width="500" height="500"></canvas>
    `
    var ctx = document.getElementById(encodeURIComponent(chartTitleObject.title));
    var myChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: '# of songs',
                data: data,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(255, 206, 86, 0.2)',
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(153, 102, 255, 0.2)',
                    'rgba(255, 159, 64, 0.2)',
                    'rgba(255, 60, 160, 0.2)'
                ],
                borderColor: [
                    'rgba(255,99,132,1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(255, 60, 160, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero:true
                    }
                }]
            },
            title: {
                display: true,
                text: chartTitle
            }
        }
    })
    ctx.style.display = "inline"
}

function updateSongCount(tracks) {
    document.getElementById("totalSongs").innerHTML = songs.length
}

function printDate() {
    var temp = new Date();
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    var dateStr = `${temp.getDate()} ${months[temp.getMonth()]} ${temp.getFullYear()}`
    // debug (dateStr );
    return dateStr
}
