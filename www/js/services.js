angular.module('microbit.services', [])

.service('Bluetooth', function($ionicPopup) {

  var microbitServiceUuid = "e95d93af-251d-470a-a062-fa1922dfa9a8";
  var microbitWriteCharacteristicUuid = "e95d5404-251d-470a-a062-fa1922dfa9a8";
  var connect = false;
  var bleObject = null;

  var initializeSuccess = function(){
    console.log("BLE SUCC");
  };
  var initializeError = function(err){
    console.log("BLE ERR",err);
  };
  return {
    init:function(){
      try{
        bluetoothle.initialize(initializeSuccess, initializeError, {"request": true, "statusReceiver": false});
      }catch(e){
        console.log(e);
      }
    },
    scan:function(success,error){

      var platform = navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|IEMobile)/)

      if (platform == "Android"){
        this.discover(success,error);
        return
      }

      var paramsObj = {serviceUuids:[]};
      try{
        bluetoothle.startScan(success, error, paramsObj);
      }catch(e){
        alert("scan "+JSON.stringify(e));
      }
    },
    stopScan:function(success,error){
      try{
        bluetoothle.stopScan(success, error);
      }catch(e){
        alert("stop scan "+JSON.stringify(e));
      }
    },
    discover:function(success,error){
      var paramsObj = {serviceUuids:[]};
      try{
        bluetoothle.discover(success, error, paramsObj);
      }catch(e){
        alert(e);
      }
    },
    connect:function(success,error,address){
      var paramsObj = {address:address};
      try{
        bluetoothle.connect(success, error, paramsObj);
      }catch(e){
        alert(e);
      }
    },
    connected:function(){
      return connected;
    },
    getServices:function(success,error,address){
      var paramsObj = {address:address};
      try{
        bluetoothle.services(success,error,paramsObj);
      }catch(e){
        alert(e);
      }
    },
    getCharacteristics:function(success,error,address,serviceUuid){
      var paramsObj = {address:address, serviceUuid:serviceUuid};
      try{
        bluetoothle.characteristics(success,error,paramsObj);
      }catch(e){
        alert(e);
      }
    },
    getConnected:function(object){
      return bleObject;
    },
    getUuids:function(){
      return {serviceUuid:microbitServiceUuid, characteristicUuid:microbitWriteCharacteristicUuid};
    },
    setConnected:function(object){
      connected = true;
      bleObject = object;
    },
    disconnect:function(success,error){
      connected = false;
      bleObject = null;
      try{
        bluetoothle.disconnect(success,error);
      }catch(e){
        alert(e);
      }
    },
    write:function(success,error,id,value){

      if(bleObject === null){
        $ionicPopup.alert({
          title: 'No device connected',
          template: 'Woah! You need to connect to your micro:bit first!'
        });
        return;
      }

      /*var packet = new Uint16Array(2);
      packet[0]=reason;
      packet[1]=id;*/

      var packetu16 = new Uint16Array([id,value]); // Create a new Types Array, which is a special view for an Array Buffer
      

      var packetu8 = new Uint8Array(packetu16.buffer);

      //alert(bluetoothle.bytesToEncodedString(packetu8));

      var paramsObj = {
        value: bluetoothle.bytesToEncodedString(packetu8),
        address:bleObject.address,
        serviceUuid:microbitServiceUuid,
        characteristicUuid:microbitWriteCharacteristicUuid,
        type:"giveResponse"
      };

      try{
        bluetoothle.write(success,error,paramsObj);
      }catch(e){
        alert(e);
      }
    }
  };
});

