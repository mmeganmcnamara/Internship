//create an solid green circle that appears as Idle state
import * as d3 from 'd3'

import { returnAnimationStatus } from '../utitlities'

export const idleCircle = function () {
  const h = window.innerHeight
  const w = window.innerWidth
      const svg = d3.select('body').append('svg')
      .attr('width', w)
      .attr('height', h)
      .attr('id','idleCircle')
      .attr('class', 'idle')

  svg
  .append('circle')
  .attr('cx', w / 2)
  .attr('cy', h / 2)
  .attr('r', Math.min(w, h) / 4) //radius
  .attr('fill', 'green');

  let currentCount = 0
  currentCount += returnAnimationStatus()
 
  function renderFrame () {
    if (currentCount === returnAnimationStatus()) {
      requestAnimationFrame(renderFrame)
    }
  }
  renderFrame()
}
