import { useState, useEffect } from 'react';
import { isPlatform } from '@ionic/react'

import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core'

export interface UserPhoto {
    filepath: string;
    webviewPath?: string;
}

//key for the store
const PHOTO_STORAGE = 'photos';

export function usePhotoGallery(){
    const [photos, setPhotos] = useState<UserPhoto[]>([]);

    //retrieve data when hook loads using useEffect hook from react
    useEffect(() => {
        const loadSaved = async () => {
            const { value } = await Preferences.get({ key: PHOTO_STORAGE });
            const photosInPreference = (value ? JSON.parse(value) : []) as UserPhoto[];

            for(let photo of photosInPreference) {
                const file = await Filesystem.readFile({
                    path: photo.filepath,
                    directory: Directory.Data,
                });
                //Web Platform only: load the photo as base64 data
                photo.webviewPath = `data:image/jpeg;base64,${file.data}`;
            }
            setPhotos(photosInPreference);
        };
        loadSaved();
    }, []);

    const takePhoto = async () => {
        const photo = await Camera.getPhoto({
            resultType: CameraResultType.Uri,
            source: CameraSource.Camera,
            quality: 100,
        });

        const fileName = Date.now() + '.jpeg';
        const savedFileImage = await savePicture(photo, fileName)
        const newPhotos = [savedFileImage, ...photos,
        ];
        setPhotos(newPhotos);
        //Save the photos array 
        //By adding it here, the Photos array is stored each time a new photo is taken. 
        //This way, it doesn’t matter when the app user closes or switches to a different app
        // - all photo data is saved.
        Preferences.set({key: PHOTO_STORAGE, value: JSON.stringify(newPhotos)})
    };
    
    const savePicture = async (photo: Photo, fileName: string): Promise<UserPhoto> => {
      let base64Data: string | Blob;
      // "hybrid" will detect Cordova or Capacitor;
      if (isPlatform('hybrid')) {
        const file = await Filesystem.readFile({
          path: photo.path!,
        });
        base64Data = file.data;
      } else {
        base64Data = await base64FromPath(photo.webPath!);
      }
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Data,
      });
    
      if (isPlatform('hybrid')) {
        // Display the new image by rewriting the 'file://' path to HTTP
        // Details: https://ionicframework.com/docs/building/webview#file-protocol
        return {
          filepath: savedFile.uri,
          webviewPath: Capacitor.convertFileSrc(savedFile.uri),
        };
      } else {
        // Use webPath to display the new image instead of base64 since it's
        // already loaded into memory
        return {
          filepath: fileName,
          webviewPath: photo.webPath,
        };
      }
    };

    return{
      photos,
      takePhoto,
  }
  
}

// Helper util downloads a file from path and returns base64 representation
export async function base64FromPath(path: string): Promise<string> {
  const response = await fetch(path);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject('method did not return a string');
      }
    };
    reader.readAsDataURL(blob);
  });
}