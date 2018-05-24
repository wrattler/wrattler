// Demos showing how to import files from different languages
// (we will need this later, but for now, this is just a demo)

import $ from 'jquery';
import {h} from 'maquette';
import {createProjector} from 'maquette';
import {VNode} from 'maquette';




var yourName = '';

function handleNameInput(evt) {
  yourName = evt.target.value;
}

export function renderMaquette() {
  return h('div', [
    h('input', { 
      type: 'text', placeholder: 'What is your name?', 
      key: 'id',
      value: yourName, oninput: handleNameInput 
    }),
    h('p.output', [
      'Hello ' + (yourName || 'you') + '!'
    ])
  ]);
 };

// createProjector().append(document.body, renderMaquette)

