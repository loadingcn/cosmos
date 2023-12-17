import regl from 'regl'
import { CoreModule } from '@/graph/modules/core-module'
import calculateLevelFrag from '@/graph/modules/ForceManyBody/calculate-level.frag'
import calculateLevelVert from '@/graph/modules/ForceManyBody/calculate-level.vert'
import forceFrag from '@/graph/modules/ForceManyBody/force-level.frag'
import forceCenterFrag from '@/graph/modules/ForceManyBody/force-centermass.frag'
import { createIndexesBuffer, createQuadBuffer, destroyFramebuffer } from '@/graph/modules/Shared/buffer'
import clearFrag from '@/graph/modules/Shared/clear.frag'
import updateVert from '@/graph/modules/Shared/quad.vert'
import { CosmosInputNode, CosmosInputLink } from '@/graph/types'

export class ForceManyBody<N extends CosmosInputNode, L extends CosmosInputLink> extends CoreModule<N, L> {
  private randomValuesFbo: regl.Framebuffer2D | undefined
  private levelsFbos = new Map<string, regl.Framebuffer2D>()
  private clearLevelsCommand: regl.DrawCommand | undefined
  private clearVelocityCommand: regl.DrawCommand | undefined
  private calculateLevelsCommand: regl.DrawCommand | undefined
  private forceCommand: regl.DrawCommand | undefined
  private forceFromItsOwnCentermassCommand: regl.DrawCommand | undefined
  private quadtreeLevels = 0
  private theta: number | undefined

  public create (): void {
    const { reglInstance, store } = this
    if (!store.pointsTextureSize) return
    this.quadtreeLevels = Math.log2(store.adjustedSpaceSize)
    for (let i = 0; i < this.quadtreeLevels; i += 1) {
      const levelTextureSize = Math.pow(2, i + 1)
      this.levelsFbos.set(`levelFbo[${i}]`, reglInstance.framebuffer({
        shape: [levelTextureSize, levelTextureSize],
        colorType: 'float',
        depth: false,
        stencil: false,
      })
      )
    }
    // Create random number to prevent point to stick together in one coordinate
    const randomValuesState = new Float32Array(store.pointsTextureSize * store.pointsTextureSize * 4)
    for (let i = 0; i < store.pointsTextureSize * store.pointsTextureSize; ++i) {
      randomValuesState[i * 4] = store.getRandomFloat(-1, 1) * 0.00001
      randomValuesState[i * 4 + 1] = store.getRandomFloat(-1, 1) * 0.00001
    }

    this.randomValuesFbo = reglInstance.framebuffer({
      color: reglInstance.texture({
        data: randomValuesState,
        shape: [store.pointsTextureSize, store.pointsTextureSize, 4],
        type: 'float',
      }),
      depth: false,
      stencil: false,
    })
  }

  public initPrograms (): void {
    const { reglInstance, config, store, data, points } = this
    this.theta = config.simulation?.repulsionTheta
    this.clearLevelsCommand = reglInstance({
      frag: clearFrag,
      vert: updateVert,
      framebuffer: (_: regl.DefaultContext, props: { levelFbo: regl.Framebuffer2D }) => props.levelFbo,
      primitive: 'triangle strip',
      count: 4,
      attributes: { quad: createQuadBuffer(reglInstance) },
    })
    this.calculateLevelsCommand = reglInstance({
      frag: calculateLevelFrag,
      vert: calculateLevelVert,
      framebuffer: (_: regl.DefaultContext, props: { levelFbo: regl.Framebuffer2D; levelTextureSize: number; cellSize: number }) => props.levelFbo,
      primitive: 'points',
      count: () => data.nodes.length,
      attributes: { indexes: createIndexesBuffer(reglInstance, store.pointsTextureSize) },
      uniforms: {
        position: () => points?.previousPositionFbo,
        pointsTextureSize: () => store.pointsTextureSize,
        levelTextureSize: (_: regl.DefaultContext, props: { levelTextureSize: number }) => props.levelTextureSize,
        cellSize: (_: regl.DefaultContext, props: { cellSize: number }) => props.cellSize,
      },
      blend: {
        enable: true,
        func: {
          src: 'one',
          dst: 'one',
        },
        equation: {
          rgb: 'add',
          alpha: 'add',
        },
      },
      depth: { enable: false, mask: false },
      stencil: { enable: false },
    })

    this.forceCommand = reglInstance({
      frag: forceFrag,
      vert: updateVert,
      framebuffer: () => points?.velocityFbo as regl.Framebuffer2D,
      primitive: 'triangle strip',
      count: 4,
      attributes: { quad: createQuadBuffer(reglInstance) },
      uniforms: {
        position: () => points?.previousPositionFbo,
        level: (_, props: { levelFbo: regl.Framebuffer2D; levelTextureSize: number; level: number }) => props.level,
        maxlevel: this.quadtreeLevels,
        levels: this.quadtreeLevels,
        levelFbo: (_, props) => props.levelFbo,
        // levelTextureSize: (_, props) => props.levelTextureSize,
        alpha: () => store.alpha,
        repulsion: () => config.simulation?.repulsion,
        spaceSize: () => store.adjustedSpaceSize,
        theta: () => config.simulation?.repulsionTheta,
        // ...Object.fromEntries(this.levelsFbos),
      },
      blend: {
        enable: true,
        func: {
          src: 'one',
          dst: 'one',
        },
        equation: {
          rgb: 'add',
          alpha: 'add',
        },
      },
      depth: { enable: false, mask: false },
      stencil: { enable: false },
    })
    this.forceFromItsOwnCentermassCommand = reglInstance({
      frag: forceCenterFrag,
      vert: updateVert,
      framebuffer: () => points?.velocityFbo as regl.Framebuffer2D,
      primitive: 'triangle strip',
      count: 4,
      attributes: { quad: createQuadBuffer(reglInstance) },
      uniforms: {
        position: () => points?.previousPositionFbo,
        randomValues: () => this.randomValuesFbo,
        levelFbo: (_, props: { levelFbo: regl.Framebuffer2D; levelTextureSize: number }) => props.levelFbo,
        levelTextureSize: (_, props) => props.levelTextureSize,
        alpha: () => store.alpha,
        repulsion: () => config.simulation?.repulsion,
        spaceSize: () => store.adjustedSpaceSize,
      },
      blend: {
        enable: true,
        func: {
          src: 'one',
          dst: 'one',
        },
        equation: {
          rgb: 'add',
          alpha: 'add',
        },
      },
      depth: { enable: false, mask: false },
      stencil: { enable: false },
    })
    this.clearVelocityCommand = reglInstance({
      frag: clearFrag,
      vert: updateVert,
      framebuffer: () => points?.velocityFbo as regl.Framebuffer2D,
      primitive: 'triangle strip',
      count: 4,
      attributes: { quad: createQuadBuffer(reglInstance) },
    })
  }

  public run (): void {
    const { store } = this
    for (let i = 0; i < this.quadtreeLevels; i += 1) {
      this.clearLevelsCommand?.({ levelFbo: this.levelsFbos.get(`levelFbo[${i}]`) })
      const levelTextureSize = Math.pow(2, i + 1)
      const cellSize = store.adjustedSpaceSize / levelTextureSize
      this.calculateLevelsCommand?.({
        levelFbo: this.levelsFbos.get(`levelFbo[${i}]`),
        levelTextureSize,
        cellSize,
      })
    }

    // this.clearVelocityCommand?.()
    // this.forceCommand?.()

    let levelTextureSize = 0.0
    const totalLv = Math.floor(this.quadtreeLevels / 1)
    for (let i = 0; i < totalLv; i += 1) {
      levelTextureSize = Math.pow(2, i + 1)
      this.forceCommand?.({
        levelFbo: this.levelsFbos.get(`levelFbo[${i}]`),
        levelTextureSize,
        level: i,
      })
    }

    levelTextureSize = Math.pow(2, totalLv)
    this.forceFromItsOwnCentermassCommand?.({
      levelFbo: this.levelsFbos.get(`levelFbo[${totalLv - 1}]`),
      levelTextureSize,
      level: totalLv - 1,
    })
  }

  public destroy (): void {
    destroyFramebuffer(this.randomValuesFbo)
    this.levelsFbos.forEach(fbo => {
      destroyFramebuffer(fbo)
    })
    this.levelsFbos.clear()
  }
}
