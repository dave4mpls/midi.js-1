/*
  ----------------------------------------------------------------------
  Web MIDI API - Native Soundbanks
  ----------------------------------------------------------------------
  http://webaudio.github.io/web-midi-api/
  ----------------------------------------------------------------------
*/
import root from '../root'

(function () {
  var MIDIAccess = null;
  var plugin = null;
  var output = null;  // ARRAY of current outputs now (can handle multiple midi inputs/outputs)
  var onmidimessage = null;  // you set this to a function to receive midi input messages.
  var input = null;   // ARRAY of current inputs now (can handle multiple midi inputs/outputs)
  var outputList = [ ];  // lists input id's and names in order (e.g. for a dropdown box)
  var inputList = [ ];
  var inputHash = { };  // maps id to the actual MIDI input object.
  var outputHash = { };
  var midi = root.WebMIDI = {api: 'webmidi'}

  midi.send = function (data, delay) { // set channel volume
    if (delay > 0)
      setTimeout(function() { midi.send(data); }, delay * 1000);
    else {
      // remember, we now handle multiple outputs!  You send to all currently selected ones.
      for (var i = 0; i < midi.output.length; i++)
        {
        if (!midi.output[i]) {
          // special case: internal output.  Handle note on, off, program change, pitch bend
          // messages, and convert back to subroutine calls to webaudio / audiotag routines.
          var myChannel = data[0] & 0x0F;
          switch (data[0] & 0xF0) {
            case 0x80: root.noteOff(myChannel, data[1], 0); break;
            case 0x90: root.noteOn(myChannel, data[1], data[2], 0); break;
            case 0x00: break;  // ignore set controller
            case 0xB0:
              if (data[1] == 0x7B) root.stopAllNotes();   // do send stop-all-notes message
              break;  // ignore set volume
            case 0xC0: root.programChange(myChannel, data[1], 0); break;
            case 0xE0: root.pitchBend(myChannel, data[1], 0); break;
            default: break;  // ignore all other MIDI messages
          }
        }
        else    // Regular WebMIDI output channel: Send the data over the wire!
          midi.output[i].send(data);
        }
    }
  }

  midi.setController = function (channel, type, value, delay) {
    channel &= 0x0F;
    midi.send([channel, type, value], delay)
  }

  midi.setVolume = function (channel, volume, delay) { // set channel volume
    channel &= 0x0F;
    midi.send([0xB0 + channel, 0x07, volume], delay)
  }

  midi.programChange = function (channel, program, delay) { // change patch (instrument)
    channel &= 0x0F;
    midi.send([0xC0 + channel, program], delay)
  }

  midi.pitchBend = function (channel, program, delay) { // pitch bend
    channel &= 0x0F;
    if (program < 0) program = 0;
    if (program > 16383) program = 16383;
    let program_lsb = program & 0x7F;
    let program_msb = program >> 7;
    midi.send([0xE0 + channel, program_lsb, program_msb], delay)
  }

  midi.noteOn = function (channel, note, velocity, delay) {
    channel &= 0x0F;
    midi.send([0x90 + channel, note, velocity], delay)
  }

  midi.noteOff = function (channel, note, delay) {
    channel &= 0x0F;
    midi.send([0x80 + channel, note, 0], delay)
  }

  midi.chordOn = function (channel, chord, velocity, delay) {
    for (var n = 0; n < chord.length; n++) {
      var note = chord[n]
      midi.send([0x90 + channel, note, velocity], delay)
    }
  }

  midi.chordOff = function (channel, chord, delay) {
    for (var n = 0; n < chord.length; n++) {
      var note = chord[n]
      midi.send([0x80 + channel, note, 0], delay)
    }
  }

  midi.stopAllNotes = function () {
    for (var channel = 0; channel < 16; channel++) {
      midi.send([0xB0 + channel, 0x7B, 0])
    }
  }

  midi.getInputs = function() {
    return midi.inputList;
  }

  midi.getOutputs = function() {
    return midi.outputList;
  }

  midi.refreshInputs = function () {
    // read all the midi inputs into the inputList array.
    // First input is always the On-Screen Keyboard, which the implementor has to implement
    // themselves.
    midi.inputList = [ { id: "internal", name: "On Screen Keyboard"} ];
    midi.inputHash = { "internal": null };
    var allInputs = midi.MIDIAccess.inputs;
    allInputs.forEach(function(thisInput) {
      midi.inputList.push({id: thisInput.id, name: thisInput.name});
      midi.inputHash[thisInput.id] = thisInput;
    });
    return midi.inputList;
  }

  midi.refreshOutputs = function() {
    // read all the midi OUTputs into the outputList array.
    // First output is always the Internal Synthesizer, which directs output through
    // either the webaudio or audiotag synthesizer, whichever is available.
    midi.outputList = [ { id: "internal", name: "Internal Synthesizer"}];
    midi.outputHash = { "internal": null };
    var allOutputs = midi.MIDIAccess.outputs;
    allOutputs.forEach(function(thisOutput) { 
      midi.outputList.push({id: thisOutput.id, name: thisOutput.name});
      midi.outputHash[thisOutput.id] = thisOutput;
    });
    return midi.outputList;
  }

  midi.closeAllInputs = function() {
    // be good about closing inputs and outputs when not in use.
    // we don't listen on all inputs because then no other programs may be able to use them.
    midi.refreshInputs();
    for (var i = 0; i < midi.inputList.length; i++) {
      if (!midi.inputHash[midi.inputList[i].id]) continue;  // skip internal input
      try { 
        //Chrome doesn't like closing things, unfortunately.
        //midi.inputHash[midi.inputList[i].id].close();
        midi.inputHash[midi.inputList[i].id].onmidimessage = undefined; 
      } catch(e) { }
    }
  }

  midi.closeAllOutputs = function() { 
    midi.refreshOutputs();
    for (var i = 0; i < midi.outputList.length; i++) {
      try { midi.outputHash[midi.outputList[i].id].close(); } catch(e) { }
    }
  }

  midi.setOutput = function(oids) {
    // sets the output to the given ARRAY of IDs.  
    // closes all other outputs.  Note: that means we can set multiple outputs, and then it
    // will send all signals to all of them.
    midi.closeAllOutputs();
    midi.output = [ ];
    for (var i = 0; i < oids.length; i++) {
      if (midi.outputHash.hasOwnProperty(oids[i]))
        midi.output.push(midi.outputHash[oids[i]]);
    }
    return true;
  }

  midi.handleMIDIInput = function(message) {
    // this is the function that gets the midi input message first.
    if (midi.onmidimessage) midi.onmidimessage(message);  // we just pass it along if a handler is set
  }

  midi.setInput = function(iids) {
    // sets the input to the given ARRAY of IDs.  
    // closes all other inputs.  Note: that means you can set multiple inputs, and it will
    // send input messages for all of them; you can use the message's data to find out which one
    // sent the input.
    midi.closeAllInputs();
    midi.input = [ ];
    for (var i = 0; i < iids.length; i++) {
      if (midi.inputHash.hasOwnProperty(iids[i])) {
        var thisInput = midi.inputHash[iids[i]];
        if (thisInput) {
          thisInput.onmidimessage = midi.handleMIDIInput;
          thisInput.open();
        }
        midi.input.push(thisInput);
      }
    }
    return true;
  }

  midi.connect = function (opts) {
    //-- we do NOT set web midi to be the default for noteOn, etc.
    //   callers must access it directly after setting output, etc.
    //root.setDefaultPlugin(midi)
    var errFunction = function (err) { // well at least we tried!
      opts.afterMidiFunction();
    }
    // /
    let midiAccessFunction = function() {
      plugin = midi.MIDIAccess;
      midi.refreshInputs();
      midi.refreshOutputs();
      // we do NOT call the on-success function -- instead we call the afterMidiFunction,
      // which is passed by the loader.  It loads the main sound plugin (typically webaudio),
      // and then calls the success function.  This way, the order is correct and by the time
      // the caller's success function gets called, both Midi and WebAudio will be ready.
      // (Remember, this midiAccessFunction gets called asynchronously by the "then" clause on
      // requestMIDIAccess.)
      opts.afterMidiFunction();
    };
    if (midi.MIDIAccess) {
        midiAccessFunction();
    }
    else {
        navigator.requestMIDIAccess().then(function(access) {
          midi.MIDIAccess = access;
          midiAccessFunction();
        }, errFunction);
    }
  }
})()
