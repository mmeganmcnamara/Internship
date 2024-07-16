import { circleGraph } from './visualizations/circle_graph'
import { idleCircle } from './visualizations/idle_circle'
import { loadingCircle } from './visualizations/loading_circle'

import { removeVisualizer, changeAnimationStatus } from './utitlities'

import './visualizations/circle_graph'

import './styles/animation.scss'
import { interpolateRgb } from 'd3'


var vizInit = function(){
  const idleCircleButton = document.getElementById('idle-status')
  const loadingCircleButton = document.getElementById('loading-status')
  const circleGraphButton = document.getElementById('circle-graph-button')
  
  const audio = document.getElementById('audio')

  let selectedVisualizer = 'idleCircle' //set initial animation to idle
  let selectedColor = 'greensD3'

  const visualizerObj = {
    idleCircle:{
      button: idleCircleButton,
      visualizer: idleCircle
    },
    circleGraph: {
      button: circleGraphButton,
      visualizer: circleGraph
    },
    loadingCircle: {
      button: loadingCircleButton,
      visualizer: loadingCircle
    },
  }
  
  const colorObj = {
    greensD3: {
      color: interpolateRgb("darkgreen", "lightgreen")
    },
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext
  let contextCreated = false
  let context
  let analyser
  let gain

  const createContext = () => {
    contextCreated = true
    context = new AudioContext()
    analyser = context.createAnalyser()
    analyser.minDecibels = -105
    analyser.maxDecibels = -25
    analyser.smoothingTimeConstant = 0.8
    gain = context.createGain()
    const src = context.createMediaElementSource(audio)
    src.connect(gain)
    gain.connect(analyser)
    analyser.connect(context.destination)
    createVisualizer() 
  }

  const createVisualizer = () => {
    changeAnimationStatus()
    removeVisualizer()
    if (contextCreated && selectedVisualizer !== 'idleCircle') {
      visualizerObj[selectedVisualizer].visualizer(analyser, colorObj[selectedColor].color)
    } else {
      visualizerObj[selectedVisualizer].visualizer()
    }
  }
  

  const switchVisualizer = (newVisualizer) => {
    if (selectedVisualizer !== newVisualizer) {
    if (visualizerObj[selectedVisualizer].button) {
      visualizerObj[selectedVisualizer].button.classList.remove('active-visualizer')
    }
    selectedVisualizer = newVisualizer
    if (visualizerObj[selectedVisualizer].button) {
      visualizerObj[selectedVisualizer].button.classList.add('active-visualizer')
    }
    createVisualizer()
    }
  }


  circleGraphButton.onclick = () => {
    if (!contextCreated) {
      createContext()
    }
    audio.play()
    switchVisualizer('circleGraph')
  }
  idleCircleButton.onclick = () => {
    audio.pause()
    switchVisualizer('idleCircle')
  }
  loadingCircleButton.onclick = () => {
    if (!contextCreated) {
      createContext()
    }
    switchVisualizer('loadingCircle')
  }



  audio.onpause = () => {
    switchVisualizer('idleCircle')
  }

  audio.onplaying = () => {
    switchVisualizer('circleGraph')
  }
//need to fix: when loading play loading circle
  audio.onload = () => {
    switchVisualizer('loadingCircle')
  }


  audio.src = './Avataraudio-Testcopy.mp3'
  audio.load()

  createVisualizer()
}

window.onload = vizInit