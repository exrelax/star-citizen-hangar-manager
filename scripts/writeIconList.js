/* eslint-disable */
import fs from 'fs'
import path from 'path'

const baseFolder = './src/assets/svg-sprites'

// Read the contents of the base folder
const subFolders = fs.readdirSync(baseFolder)

const result = []

subFolders.forEach((subFolder) => {
  const folderPath = path.join(baseFolder, subFolder)

  // Check if the "subFolder" is a directory
  if (fs.statSync(folderPath).isDirectory()) {
    const files = fs.readdirSync(folderPath)

    const items = files.filter((file) => file.endsWith('.svg')).map((file) => file.replace('.svg', ''))

    const viewBoxes = items.map((item) => {
      const content = fs.readFileSync(path.join(folderPath, `${item}.svg`), 'utf8');
      const viewBox = content.match(/viewBox="([^"]*)"/)[1]

      return {
        name: item,
        viewBox,
      }
    })

    result.push({
      title: subFolder === 'ui' ? 'UI' : subFolder.charAt(0).toUpperCase() + subFolder.slice(1),
      path: subFolder,
      items,
      viewBoxes
    })
  }
})

const jsonContent = JSON.stringify(result, null, 2)

fs.writeFileSync('./src/assets/icons.json', jsonContent)
