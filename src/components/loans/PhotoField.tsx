import React, { useRef, useState } from 'react';
import { Camera, X, Upload, Loader2 } from 'lucide-react';

interface PhotoFieldProps {
  label: string;
  value?: string;
  onChange: (url: string | undefined) => void;
  loading?: boolean;
  // Mode d'affichage : 'inline' (preview+upload) ou 'compact' (juste bouton)
  variant?: 'inline' | 'compact';
  // Taille max en Mo (defaut 2)
  maxSizeMb?: number;
}

/**
 * PhotoField — Upload d'une image (FileReader → base64).
 *
 * Simple, sans backend : stocke l'image en base64 dans la DB.
 * Limite 2 Mo par défaut pour eviter les transactions trop lourdes.
 *
 * Variantes :
 *  - 'inline' (defaut) : preview + bouton changer/supprimer (comme SettingsPage)
 *  - 'compact' : juste un bouton "+ Photo" (pour integrer dans un formulaire)
 */
const PhotoField: React.FC<PhotoFieldProps> = ({
  label, value, onChange, loading, variant = 'inline', maxSizeMb = 2,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const maxSize = maxSizeMb * 1024 * 1024;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Le fichier doit etre une image (JPG, PNG, WebP...)');
      return;
    }
    if (file.size > maxSize) {
      alert(`Image trop grosse (> ${maxSizeMb} Mo). Compresse-la avant de l'uploader.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.onerror = () => alert('Erreur de lecture du fichier');
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // === VARIANT COMPACT : juste un bouton ===
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="hidden"
        />
        {value ? (
          <div className="flex items-center gap-2 flex-1">
            <img
              src={value}
              alt={label}
              className="w-12 h-12 rounded-lg object-cover border border-gray-200"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-blue-600 hover:underline"
            >
              Changer
            </button>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="p-1 text-red-500 hover:bg-red-50 rounded"
              title="Supprimer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border-2 border-dashed border-gray-300 hover:border-orange-400 text-gray-600 hover:text-orange-700 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            {label}
          </button>
        )}
      </div>
    );
  }

  // === VARIANT INLINE : preview large + drag-and-drop ===
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
        <Camera className="w-3.5 h-3.5" />
        {label}
      </label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="hidden"
      />
      {value ? (
        <div className="flex items-start gap-3">
          <img
            src={value}
            alt={label}
            className="w-24 h-24 rounded-lg object-cover border-2 border-gray-200"
          />
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded font-medium"
            >
              Changer
            </button>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-xs px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded font-medium flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Supprimer
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          disabled={loading}
          className={`w-full px-3 py-6 border-2 border-dashed rounded-lg flex flex-col items-center gap-1 transition-colors disabled:opacity-50 ${
            dragOver
              ? 'border-orange-500 bg-orange-50 text-orange-700'
              : 'border-gray-300 text-gray-500 hover:border-orange-400 hover:text-orange-600'
          }`}
        >
          {loading
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <Upload className="w-5 h-5" />}
          <span className="text-xs font-medium">{label}</span>
          <span className="text-[10px] opacity-70">JPG, PNG, WebP — max {maxSizeMb} Mo</span>
        </button>
      )}
    </div>
  );
};

export default PhotoField;
