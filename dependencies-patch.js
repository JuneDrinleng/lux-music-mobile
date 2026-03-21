// 修补依赖源码以使构建的依赖恢复正常工作

const fs = require('node:fs')
const path = require('node:path')

const rootPath = path.join(__dirname, './')

const imageColorsGradlePath = path.join(rootPath, 'node_modules/react-native-image-colors/android/build.gradle')
const imageColorsManifestPath = path.join(rootPath, 'node_modules/react-native-image-colors/android/src/main/AndroidManifest.xml')
const imageColorsGradlePatched = `def DEFAULT_COMPILE_SDK_VERSION = 34
def DEFAULT_MIN_SDK_VERSION = 16
def DEFAULT_TARGET_SDK_VERSION = 34

def safeExtGet(prop, fallback) {
    rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
}

apply plugin: 'com.android.library'

android {
    namespace "com.reactnativeimagecolors"
    compileSdkVersion safeExtGet('compileSdkVersion', DEFAULT_COMPILE_SDK_VERSION)
    defaultConfig {
        minSdkVersion safeExtGet('minSdkVersion', DEFAULT_MIN_SDK_VERSION)
        targetSdkVersion safeExtGet('targetSdkVersion', DEFAULT_TARGET_SDK_VERSION)
        versionCode 1
        versionName "1.0"
    }
    lintOptions {
        abortOnError false
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}

repositories {
    maven {
        url "$rootDir/../node_modules/react-native/android"
    }
    maven {
        url "$rootDir/../node_modules/jsc-android/dist"
    }
    google()
    mavenCentral()
}

dependencies {
    implementation 'com.facebook.react:react-native:+'
    implementation 'androidx.palette:palette:1.0.0'
}
`

const patchs = [
  [
    imageColorsGradlePath,
    /[\s\S]*/,
    imageColorsGradlePatched,
  ],
  [
    imageColorsManifestPath,
    /\s+package="com\.reactnativeimagecolors"/,
    '',
  ],
]

;(async() => {
  for (const [filePath, fromStr, toStr] of patchs) {
    console.log(`Patching ${filePath.replace(rootPath, '')}`)
    try {
      const file = (await fs.promises.readFile(filePath)).toString()
      await fs.promises.writeFile(filePath, file.replace(fromStr, toStr))
    } catch (err) {
      console.error(`Patch ${filePath.replace(rootPath, '')} failed: ${err.message}`)
    }
  }
  console.log('\nDependencies patch finished.\n')
})()

