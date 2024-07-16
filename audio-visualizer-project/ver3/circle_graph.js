import { scaleSequential, selectAll, select } from 'd3'

import { returnAnimationStatus } from '../utitlities'

export const circleGraph = function (analyser, colors) {
  analyser.fftSize = 128

  const dataArray = new Uint8Array(analyser.frequencyBinCount)

  const colorScale = scaleSequential(colors)
    .domain([0, dataArray.length - 1])

  const h = window.innerHeight
  const w = window.innerWidth

  let svg

  if (document.getElementById('visualizer-svg')) {
    selectAll('svg > *').remove()
  } else {
    selectAll('svg').remove()
    svg = select('body').append('svg')
      .attr('width', w)
      .attr('height', h)
      .attr('id', 'visualizer-svg')
  }

  svg.selectAll('circle')
    .data(dataArray)
    .enter().append('circle')
    .attr('cx', (w / 2))
    .attr('cy', (h / 2))

  let currentCount = 0 //number of times a button is pressed
  currentCount += returnAnimationStatus()
 //console.log(currentCount, "is the current count")
 
  function renderFrame () {
    if (currentCount === returnAnimationStatus()) {
      requestAnimationFrame(renderFrame)
    }
    analyser.getByteFrequencyData(dataArray)

    svg.selectAll('circle')
      .data(dataArray)
      .attr('r', function (d) { return ((((w > h ? h : w)) / 2) * (d / 255)) })
      .attr('fill', function (d, i) { return colorScale(i) })
  }
  renderFrame()
}
