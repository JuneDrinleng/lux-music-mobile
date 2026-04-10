// 修补依赖源码以使构建的依赖恢复正常工作

const fs = require('node:fs')
const path = require('node:path')

const rootPath = path.join(__dirname, './')
const dependencyPatchBasePath = path.join(rootPath, 'dependency-patches')

const imageColorsGradlePath = path.join(rootPath, 'node_modules/react-native-image-colors/android/build.gradle')
const imageColorsManifestPath = path.join(rootPath, 'node_modules/react-native-image-colors/android/src/main/AndroidManifest.xml')
const trackPlayerPatchBasePath = path.join(dependencyPatchBasePath, 'react-native-track-player')
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

const copyPatchs = [
  [
    path.join(trackPlayerPatchBasePath, 'android/src/main/java/com/guichaguri/trackplayer/service/Utils.java'),
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/Utils.java'),
  ],
  [
    path.join(trackPlayerPatchBasePath, 'android/src/main/java/com/guichaguri/trackplayer/service/MusicService.java'),
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/MusicService.java'),
  ],
  [
    path.join(trackPlayerPatchBasePath, 'android/src/main/java/com/guichaguri/trackplayer/module/MusicModule.java'),
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/module/MusicModule.java'),
  ],
  [
    path.join(trackPlayerPatchBasePath, 'android/src/main/java/com/guichaguri/trackplayer/service/models/Track.java'),
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/models/Track.java'),
  ],
  [
    path.join(trackPlayerPatchBasePath, 'android/src/main/java/com/guichaguri/trackplayer/service/player/ExoPlayback.java'),
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/player/ExoPlayback.java'),
  ],
  [
    path.join(trackPlayerPatchBasePath, 'android/src/main/java/com/guichaguri/trackplayer/service/player/LocalPlayback.java'),
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/player/LocalPlayback.java'),
  ],
  [
    path.join(trackPlayerPatchBasePath, 'android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
  ],
  [
    path.join(trackPlayerPatchBasePath, 'lib/trackPlayer.js'),
    path.join(rootPath, 'node_modules/react-native-track-player/lib/trackPlayer.js'),
  ],
  [
    path.join(trackPlayerPatchBasePath, 'lib/trackPlayer.d.ts'),
    path.join(rootPath, 'node_modules/react-native-track-player/lib/trackPlayer.d.ts'),
  ],
  [
    path.join(trackPlayerPatchBasePath, 'android/src/main/res/drawable/trackplayer_like.xml'),
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/res/drawable/trackplayer_like.xml'),
  ],
  [
    path.join(trackPlayerPatchBasePath, 'android/src/main/res/drawable/trackplayer_like_active.xml'),
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/res/drawable/trackplayer_like_active.xml'),
  ],
]

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
  for (const [fromPath, toPath] of copyPatchs) {
    console.log(`Copy patch ${toPath.replace(rootPath, '')}`)
    try {
      await fs.promises.mkdir(path.dirname(toPath), { recursive: true })
      await fs.promises.copyFile(fromPath, toPath)
    } catch (err) {
      console.error(`Copy patch ${toPath.replace(rootPath, '')} failed: ${err.message}`)
    }
  }
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

