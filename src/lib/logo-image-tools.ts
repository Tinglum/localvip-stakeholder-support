export type LogoAction = 'remove-background' | 'upscale'

const MAX_SIDE = 4096

export async function processLogo(file: File, action: LogoAction): Promise<File> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = action === 'upscale' ? Math.min(2, MAX_SIDE / Math.max(bitmap.width, bitmap.height)) : 1
    if (action === 'upscale' && scale <= 1) throw new Error('This logo is already large enough to use.')
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d', { willReadFrequently: action === 'remove-background' })
    if (!context) throw new Error('Image editing is unavailable in this browser.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    if (action === 'remove-background') {
      const { width, height } = canvas
      const image = context.getImageData(0, 0, width, height)
      const data = image.data
      const corners = [0, (width - 1) * 4, (height - 1) * width * 4, (height * width - 1) * 4]
      const colors = corners.map((i) => [data[i], data[i + 1], data[i + 2]])
      const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
      const background = colors.filter((color) => colors.filter((other) => distance(color, other) < 35).length >= 3)[0]
      if (!background) throw new Error('The background is not a consistent solid color. Try a logo with a plain background.')
      const visited = new Uint8Array(width * height)
      const queue = new Int32Array(width * height)
      let head = 0
      let tail = 0
      const add = (pixel: number) => {
        if (visited[pixel]) return
        const i = pixel * 4
        if (Math.hypot(data[i] - background[0], data[i + 1] - background[1], data[i + 2] - background[2]) > 48) return
        visited[pixel] = 1
        queue[tail++] = pixel
      }
      for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x) }
      for (let y = 0; y < height; y++) { add(y * width); add(y * width + width - 1) }
      if (!tail) throw new Error('No solid background was found around the logo.')
      while (head < tail) {
        const pixel = queue[head++]
        const x = pixel % width
        if (x > 0) add(pixel - 1)
        if (x < width - 1) add(pixel + 1)
        if (pixel >= width) add(pixel - width)
        if (pixel < width * (height - 1)) add(pixel + width)
      }
      for (let pixel = 0; pixel < visited.length; pixel++) if (visited[pixel]) data[pixel * 4 + 3] = 0
      context.putImageData(image, 0, 0)
    }

    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not export the edited logo.')), 'image/png'))
    const name = file.name.replace(/\.[^.]+$/, '') + (action === 'upscale' ? '-2x' : '-transparent') + '.png'
    return new File([blob], name, { type: 'image/png' })
  } finally {
    bitmap.close()
  }
}
