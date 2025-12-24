"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Cloud, Server } from "lucide-react";
import { ExportButton } from "@/components/actions/ExportButton";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { format } from 'date-fns';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

const CodeBlock = ({ children }: { children: React.ReactNode }) => (
    <div className="not-prose my-4">
        <pre className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 text-sm font-mono text-emerald-300 overflow-x-auto">
            <code>{children}</code>
        </pre>
    </div>
);


export default function PrincipeStockageCloudPage() {

    const handleExportPdf = () => {
        const doc = new jsPDF();
        doc.text("Guide d'Utilisation de Cloud Storage pour Firebase", 14, 20);
        // ... Logique d'exportation PDF ...
        doc.save("Guide_Cloud_Storage.pdf");
    };

    const handleExportWord = () => {
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ text: "Guide d'Utilisation de Cloud Storage pour Firebase", heading: HeadingLevel.TITLE }),
                    // ... Logique d'exportation Word ...
                ],
            }],
        });
        Packer.toBlob(doc).then(blob => {
            saveAs(blob, "Guide_Cloud_Storage.docx");
        });
    };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
            <CardTitle className="text-3xl font-bold flex items-center gap-3 not-prose">
            <Cloud className="h-8 w-8 text-primary" />
            Guide d'Utilisation de Cloud Storage
            </CardTitle>
            <ExportButton onPdfExport={handleExportPdf} onWordExport={handleExportWord} />
        </div>

      <Card className="prose prose-invert max-w-none prose-h2:text-primary prose-h2:font-semibold prose-h3:text-emerald-400 prose-p:leading-relaxed prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-strong:text-white">
        <CardHeader>
          <CardDescription className="not-prose text-lg">
            Ce document explique comment configurer et utiliser Cloud Storage pour Firebase pour gérer les fichiers de votre application.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <h2>Étape 1 : Assurez-vous que Firebase est configuré</h2>
            <p>
                Avant de pouvoir utiliser Cloud Storage, votre projet Firebase doit être correctement configuré. Cela implique généralement d'ajouter le fichier de configuration Firebase (par exemple, <code>firebaseConfig</code> pour le web) à votre projet et d'initialiser Firebase.
            </p>

            <h2>Étape 2 : Ajoutez le SDK Cloud Storage</h2>
            <p>
                Pour le web, vous devez importer les fonctions nécessaires depuis le SDK Firebase.
            </p>
            <CodeBlock>
{`import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

// Votre configuration Firebase
const firebaseConfig = { /* ... */ };

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);`}
            </CodeBlock>

            <h2>Étape 3 : Créez des Références de Stockage</h2>
            <p>
                Une "référence" est un pointeur vers un fichier ou un dossier dans votre espace de stockage.
            </p>
             <CodeBlock>
{`import { ref } from 'firebase/storage';

const storageRef = ref(storage); // Référence à la racine
const imagesRef = ref(storage, 'images'); // Référence au dossier 'images'
const montagneRef = ref(storage, 'images/montagne.jpg'); // Référence à un fichier`}
            </CodeBlock>

            <h2>Étape 4 : Téléchargez des Fichiers (Upload)</h2>
            <p>
                Vous pouvez surveiller la progression du téléchargement et gérer les erreurs.
            </p>
            <CodeBlock>
{`import { uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const file = /* votre fichier via un <input type="file"> */;
const uploadRef = ref(storage, 'images/' + file.name);

const uploadTask = uploadBytesResumable(uploadRef, file);

uploadTask.on('state_changed',
  (snapshot) => {
    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
    console.log('Upload is ' + progress + '% done');
  },
  (error) => {
    console.error("Erreur d'upload :", error);
  },
  () => {
    getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
      console.log('Fichier disponible à l\\'URL :', downloadURL);
    });
  }
);`}
            </CodeBlock>

            <h2>Étape 5 : Téléchargez des Fichiers (Download)</h2>
            <p>
                La méthode la plus courante pour le web est d'obtenir une URL de téléchargement pour afficher le fichier.
            </p>
             <CodeBlock>
{`getDownloadURL(ref(storage, 'images/montagne.jpg'))
  .then((url) => {
    // Utilisez l'URL pour afficher une image
    // const img = document.getElementById('myImage');
    // img.setAttribute('src', url);
  })
  .catch((error) => {
    console.error("Erreur lors de l'obtention de l'URL :", error);
  });`}
            </CodeBlock>

            <h2>Étape 6 : Gérez les Métadonnées</h2>
            <p>Affichez ou mettez à jour les métadonnées comme le type de contenu.</p>
             <CodeBlock>
{`import { getMetadata, updateMetadata } from 'firebase/storage';

const imageRef = ref(storage, 'images/montagne.jpg');

// Obtenir les métadonnées
getMetadata(imageRef).then((metadata) => { /* ... */ });

// Mettre à jour les métadonnées
const newMetadata = {
  contentType: 'image/jpeg',
  customMetadata: { 'description': 'Vue panoramique' }
};
updateMetadata(imageRef, newMetadata).then((metadata) => { /* ... */ });`}
            </CodeBlock>

            <h2>Étape 7 : Supprimez des Fichiers</h2>
             <CodeBlock>
{`import { deleteObject } from 'firebase/storage';

const desertRef = ref(storage, 'images/montagne.jpg');

deleteObject(desertRef).then(() => {
    console.log("Fichier supprimé avec succès.");
}).catch((error) => {
    console.error("Erreur lors de la suppression :", error);
});`}
            </CodeBlock>
            
            <h2>Étape 8 : Sécurisez votre Stockage (Crucial)</h2>
            <p>
                Pour la production, définissez des règles de sécurité pour contrôler l'accès à vos fichiers. Accédez à la console Firebase → Storage → Rules.
            </p>
             <CodeBlock>
{`rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Autoriser la lecture et l'écriture uniquement aux utilisateurs authentifiés
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }

    // Exemple : Autoriser la lecture/écriture uniquement par le propriétaire du fichier
    match /users/{userId}/{allFiles=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}`}
            </CodeBlock>

             <h2>Étape 9 : Surveillez votre Utilisation</h2>
            <p>
                Gardez un œil sur votre consommation de stockage et de bande passante via la console Firebase pour éviter les surprises au niveau des coûts.
            </p>

        </CardContent>
      </Card>
    </div>
  );
}
