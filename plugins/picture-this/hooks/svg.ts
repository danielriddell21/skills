// SVG for desktop, VS Code and mobile (no Svg in a terminal): one entry point over the graph and chart renderers.
import type { Component } from '../types'

import { bars, matrix, radar, sankey, scatter, sequence, swimlane, timeline, treemap } from './charts'
import { compare, flowGraph, graph, storyboard, tourStep, zoomTo } from './graphs'
import { MAX_SVG, usePalette } from './paint'
import type { Palette } from './paint'

export { paletteFor, wrap } from './paint'
export type { Palette } from './paint'

/**
 * The component as SVG, or undefined when it reads better as text (a tree) or is too big to send.
 * `step` picks a tour's stop; `path` the part a zoomable graph is opened into; `palette` the Claude theme's
 * colours (absent: follow the OS light/dark preference).
 */
export const svgFor = (c: Component, step = -1, path = '', palette?: Palette): string | undefined => {
  usePalette(palette)
  const out = draw(c, step, path)
  return out && out.length <= MAX_SVG ? out : undefined
}

const draw = (c: Component, step: number, path: string): string | undefined => {
  switch (c.type) {
    case 'graph': {
      const z = zoomTo(c, path)
      return graph({ ...c, nodes: z.nodes, edges: z.edges })
    }
    case 'compare':
      return compare(c)
    case 'tour':
      return tourStep(c, step)
    case 'storyboard':
      return storyboard(c)
    case 'flow':
      return graph(flowGraph(c))
    case 'sequence':
      return sequence(c)
    case 'swimlane':
      return swimlane(c)
    case 'timeline':
      return timeline(c)
    case 'matrix':
      return matrix(c)
    case 'sankey':
      return sankey(c)
    case 'treemap':
      return treemap(c)
    case 'bars':
      return bars(c)
    case 'scatter':
      return scatter(c)
    case 'radar':
      return radar(c)
    case 'tree':
      return undefined
  }
}
