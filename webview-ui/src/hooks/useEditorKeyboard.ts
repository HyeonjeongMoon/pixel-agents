import { useEffect, useRef } from 'react'
import type { EditorState } from '../office/editor/editorState.js'
import { EditTool } from '../office/types.js'

export function useEditorKeyboard(
  isEditMode: boolean,
  editorState: EditorState,
  onDeleteSelected: () => void,
  onRotateSelected: () => void,
  onToggleState: () => void,
  onUndo: () => void,
  onRedo: () => void,
  onEditorTick: () => void,
  onCloseEditMode: () => void,
): void {
  // Keep callbacks in a ref so the keydown listener is never re-attached just
  // because a parent re-rendered and produced new function references.
  const cbRef = useRef({ onDeleteSelected, onRotateSelected, onToggleState, onUndo, onRedo, onEditorTick, onCloseEditMode })
  useEffect(() => {
    cbRef.current = { onDeleteSelected, onRotateSelected, onToggleState, onUndo, onRedo, onEditorTick, onCloseEditMode }
  })

  useEffect(() => {
    if (!isEditMode) return
    const handler = (e: KeyboardEvent) => {
      const cb = cbRef.current
      if (e.key === 'Escape') {
        // Multi-stage Esc: deselect item → close tool → deselect placed → close editor
        if (editorState.activeTool === EditTool.FURNITURE_PICK) {
          editorState.activeTool = EditTool.FURNITURE_PLACE
          editorState.clearGhost()
        } else if (editorState.activeTool === EditTool.FURNITURE_PLACE && editorState.selectedFurnitureType !== '') {
          editorState.selectedFurnitureType = ''
          editorState.clearGhost()
        } else if (editorState.activeTool !== EditTool.SELECT) {
          editorState.activeTool = EditTool.SELECT
          editorState.clearGhost()
        } else if (editorState.selectedFurnitureUid) {
          editorState.clearSelection()
        } else {
          cb.onCloseEditMode()
          return
        }
        editorState.clearDrag()
        cb.onEditorTick()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editorState.selectedFurnitureUid) {
          cb.onDeleteSelected()
        }
      } else if (e.key === 'r' || e.key === 'R') {
        cb.onRotateSelected()
      } else if (e.key === 't' || e.key === 'T') {
        cb.onToggleState()
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault()
        cb.onUndo()
      } else if (
        (e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
        (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)
      ) {
        e.preventDefault()
        cb.onRedo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // editorState is a stable class instance — re-attach only when edit mode toggles
  }, [isEditMode, editorState])
}
