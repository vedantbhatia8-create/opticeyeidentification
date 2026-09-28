/**
 * MediaPipe Face Landmarker topology (478 points incl. 10 iris points).
 * "Left"/"right" are the subject's own left/right.
 */
export const LM = {
  noseTip: 1,
  noseBridge: 168,
  forehead: 10,
  chin: 152,
  cheekRight: 234,
  cheekLeft: 454,
  mouthRight: 61,
  mouthLeft: 291,
  noseRight: 98,
  noseLeft: 327,
  browRight: 105,
  browLeft: 334,
  right: {
    irisCenter: 468,
    irisEdge: [469, 470, 471, 472],
    outer: 33,
    inner: 133,
    upper: 159,
    lower: 145,
    contour: [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7],
  },
  left: {
    irisCenter: 473,
    irisEdge: [474, 475, 476, 477],
    outer: 263,
    inner: 362,
    upper: 386,
    lower: 374,
    contour: [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249],
  },
} as const

export type EyeSide = 'left' | 'right'
export type LandmarkPoint = { x: number; y: number; z: number }
