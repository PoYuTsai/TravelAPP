type PhotoWithKey = {
  _key: string
}

export function movePhotoByKey<T extends PhotoWithKey>(
  photos: T[],
  draggedKey: string,
  targetKey: string
): T[] {
  if (draggedKey === targetKey) return photos

  const draggedIndex = photos.findIndex((photo) => photo._key === draggedKey)
  const targetIndex = photos.findIndex((photo) => photo._key === targetKey)

  if (draggedIndex === -1 || targetIndex === -1) return photos

  const reordered = [...photos]
  const [draggedPhoto] = reordered.splice(draggedIndex, 1)
  reordered.splice(targetIndex, 0, draggedPhoto)

  return reordered
}
