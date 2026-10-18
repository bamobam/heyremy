// The way to the other camera: the laptop's own when the hat cam is missing or in trouble, and back to
// the hat cam. It reloads the page (the camera is chosen once, at load), so it is offered on the start
// screen too, before a recipe has been read, and the pasted text is kept across the reload.
import { CAMERA_MODE, switchCamera, useCooking } from '../cooking/contract.ts'
import { setupHelp } from './cameraHelp.ts'

export function CameraSwitch() {
  const { camera, state } = useCooking()
  const { switchTo } = setupHelp(CAMERA_MODE, camera.error)
  if (!switchTo) return null
  return (
    <button type="button" className="ui-link" onClick={() => switchCamera(switchTo.mode, state.recipeText)}>
      {switchTo.label}
    </button>
  )
}
