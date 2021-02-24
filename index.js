const network = require('network');
const net = require('net');
const scanner = require('node-wifi-scanner');

const MESH_SSID = "espmesh";
const MESH_PORT = 5555;

var apIp = "";
var apNodeId = "";
var myNodeId = "123456";
const allNodeId = 0;

var latestTimeSyncRequest = Date();
var connectionSocket = net.Socket();

scanner.scan((err, ssids) => {
    console.log(err || ssids);
    if (!err) {
        ssids.forEach((ssid) => {
            network.get_active_interface((err, obj) => {
                if (!err) {
                    if (ssid['ssid'] == MESH_SSID) {
                        apIp = obj['gateway_ip'];

                        apNodeId = getNodeId(ssid['mac']);
                        console.log('apNodeId : ' + apNodeId);

                        myNodeId = getNodeId(obj['mac_address']);
                        console.log("myNodeId : " + myNodeId);

                        connectionSocket.setKeepAlive(true);
                        connectionSocket.connect({
                            port: MESH_PORT,
                            host: apIp
                        });
                    }
                } else {
                    console.log('no active interface (please turn on wifi)');
                }
            })
        });
    } else {
        console.log('no wifi (please turn on wifi)');
    }
});

connectionSocket.on("connect", () => {
    console.log("on connected");
});

connectionSocket.on('data', (data) => {
    console.log('on data : ' + data);

    try {
        var jsonStrings = data.toString().split('\0');
        jsonStrings.forEach((jsonString) => {
            if (jsonString.length > 0) {
                var jsonData = JSON.parse(jsonString);
                let dest = jsonData['dest'];
                let from = jsonData['from'];
                let type = jsonData["type"];

                if (type == 4) {
                    console.log("TIME_SYNC_REQUEST recieved");
                    let now = Date();
                    let diffInMs = now - latestTimeSyncRequest;
                    if (diffInMs > 5000) {
                        connectionSocket.write(JSON.stringify(timeSyncRequest(from, myNodeId)) + '\0');
                        latestTimeSyncRequest = Date();
                    }
                } else if (type == 5) {
                    console.log('NODE_SYNC_REQUEST recieved');
                    connectionSocket.write(JSON.stringify(replyNodeSyncRequest(allNodeId, myNodeId)) + '\0');
                } else if (type == 8) {
                    console.log("BROADCAST_MESSAGE recieved");
                } else if (type == 0) {
                    if (dest == myNodeId) {
                        console.log("SINGLE_ADDRESSED_MESSAGE recieved");
                    }
                }
            }
        });
    } catch (e) {
        console.log(e);
    }
});

connectionSocket.on('close', () => {
    console.log('on closed');
    connectionSocket.setKeepAlive(true);
    connectionSocket.connect({
        port: MESH_PORT,
        host: apIp
    });
});

connectionSocket.on('error', (error) => {
    console.log("on error : " + error);
});

function replyNodeSyncRequest(dest, from) {
    let json = { 'dest': dest, 'from': from, 'type': 6 };

    return json;
}

function timeSyncRequest(dest, from) {
    let json = { 'dest': dest, 'from': from, type: 4, msg: [{ 'type': 0 }] };

    return json
}

function getNodeId(macAddress) {
    var calculateNodeId = -1;
    let macAddressParts = macAddress.split(':');
    if (macAddressParts.length == 6) {
        var number = parseInt(macAddressParts[2], 16);
        if (number < -1) { number = number * -1; }
        calculateNodeId = number * 256 * 256 * 256;

        number = parseInt(macAddressParts[3], 16);
        if (number < -1) { number = number * -1; }
        calculateNodeId += number * 256 * 256;

        number = parseInt(macAddressParts[4], 16);
        if (number < -1) { number = number * -1; }
        calculateNodeId += number * 256;

        number = parseInt(macAddressParts[5], 16);
        if (number < -1) { number = number * -1; }
        calculateNodeId += number;
    }

    return calculateNodeId;
}
