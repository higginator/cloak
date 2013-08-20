/* global io,console,_ */

window.cloak = (function() {

  var uid;
  var done = true;
  var socket;
  var url;
  var events = {};
  var config = {};
  var serverConfig;
  var callbacks = {};

  function handleResponsesFor(socket, responseName, dataProperty) {
    socket.on(responseName, function(data) {
      if (callbacks[responseName] !== undefined) {
        _(callbacks[responseName]).forEach(function(callback) {
          callback(data[dataProperty]);
        });
      }
      callbacks[responseName] = [];
    });
  }

  var cloak = {

    configure: function(configArg) {
      _(configArg).forEach(function(val, key) {
        if (key === 'serverEvents') {
          _(val).forEach(function(eventHandler, eventName) {
            cloak.on('cloak-' + eventName, eventHandler);
          });
        }
        else {
          config[key] = val;
        }
      });
    },

    on: function(event, handler) {
      if (events[event] === undefined) {
        events[event] = [];
      }
      events[event].push(handler);
    },

    off: function(event, handler) {
      events[event] = _(events[event]).without(handler);
    },

    trigger: function(event, arg) {
      if (events[event] !== undefined) {
        _.forEach(events[event], function(handler) {
          handler(arg);
        });
      }
    },

    run: function(urlArg) {

      url = urlArg;
      socket = io.connect(url);

      socket.on('connect', function() {
        cloak.trigger('cloak-connect');
        if (uid === undefined) {
          socket.emit('cloak-begin', {});
        }
        else {
          socket.emit('cloak-resume', {uid: uid});
        }
      });

      socket.on('disconnect', function() {
        cloak.trigger('cloak-disconnect');
        if (!done) {
          socket.socket.connect();
        }
      });

      socket.on('cloak-beginResponse', function(data) {
        uid = data.uid;
        serverConfig = data.config;
        done = false;
        cloak.trigger('cloak-begin');
      });

      socket.on('cloak-resumeResponse', function(data) {
        if (data.valid) {
          serverConfig = data.config;
          cloak.trigger('cloak-resume');
        }
        else {
          cloak.trigger('cloak-error', 'Could not resume.');
          cloak.end();
        }
      });

      handleResponsesFor(socket, 'cloak-listRoomsResponse', 'rooms');
      handleResponsesFor(socket, 'cloak-joinRoomResponse', 'success');

      _(config.messages).forEach(function(handler, name) {
        socket.on('message-' + name, function(data) {
          cloak.trigger('message-' + name, data);
        });
        cloak.on('message-' + name, handler);
      });

    },

    end: function() {
      done = true;
      this.disconnect();
      cloak.trigger('cloak-end');
    },

    disconnect: function() {
      socket.disconnect();
    },

    connected: function() {
      return socket.socket.connected;
    },

    callback: function(name, callback) {
      if (callbacks[name] === undefined) {
        callbacks[name] = [];
      }
      callbacks[name].push(callback);
    },

    listRooms: function(callback) {
      this.callback('cloak-listRoomsResponse', callback);
      socket.emit('cloak-listRooms', {});
    },

    joinRoom: function(id, callback) {
      this.callback('cloak-joinRoomResponse', callback);
      socket.emit('cloak-joinRoom', {id: id});
    },

    message: function(name, arg) {
      socket.emit('message-' + name, arg);
    }

  };

  return cloak;

})();