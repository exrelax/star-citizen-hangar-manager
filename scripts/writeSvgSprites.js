/* eslint-disable */
import { execSync } from 'child_process'
import fs from 'fs'

const svgFolder = './src/assets/svg-sprites'

fs.readdirSync(svgFolder).forEach((folderName) => {
  const folderPath = `${svgFolder}/${folderName}`
  console.log(folderPath)

  if (fs.statSync(folderPath).isDirectory()) {
    const outputFilePath = `./src/assets/${folderName}.svg`
    const command = `./node_modules/.bin/svg-symbol-sprite -i ${folderPath} -o ${outputFilePath} *.svg`
    execSync(command)
    const copyFilePath = `./src/assets/svg-sprites/${folderName}.svg`
    const copyCommand = `cp ${outputFilePath} ${copyFilePath}`
    execSync(copyCommand)
    console.log(`Generated ${outputFilePath}, Copied to ${copyFilePath}`)
  }
})
