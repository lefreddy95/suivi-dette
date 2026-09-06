import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Trash2, Check, X } from 'lucide-react';

interface SignaturePadProps {
  // Callback quand la signature est validee
  onSign: (data: { png: string; hash: string }) => void;
  // Couleur du trait
  penColor?: string;
  // Hauteur du canvas en px
  height?: number;
  // Desactive le pad
  disabled?: boolean;
}

/**
 * SignaturePad — Canvas pour dessiner une signature a la souris/doigt.
 *
 * Utilise react-signature-canvas. Convertit le trace en PNG base64 et
 * calcule un SHA-256 du payload (timestamp + PNG) pour integrite.
 *
 * Pas de dependance backend : la signature + hash sont stockes tels quels
 * dans la DB. Le hash permet de detecter une modification ulterieure.
 */
const SignaturePad: React.FC<SignaturePadProps> = ({
  onSign, penColor = '#1f2937', height = 180, disabled = false,
}) => {
  const sigRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const clear = () => {
    sigRef.current?.clear();
    setIsEmpty(true);
  };

  const handleEnd = () => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      setIsEmpty(false);
    }
  };

  const validate = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    // Genere le PNG base64 (data URL)
    const png = sigRef.current.toDataURL('image/png');
    // Hash : SHA-256 du PNG + timestamp d'aujourd'hui
    const payload = png + '|' + Date.now();
    const hash = await sha256(payload);
    onSign({ png, hash });
  };

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white">
        <SignatureCanvas
          ref={sigRef}
          penColor={penColor}
          canvasProps={{
            width: 500,
            height,
            className: 'w-full',
            style: { display: 'block', width: '100%', height: `${height}px` },
          }}
          onEnd={handleEnd}
          backgroundColor="rgba(255,255,255,0)"
          disabled={disabled}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          {isEmpty ? 'Signez ci-dessus avec votre souris ou votre doigt' : '✓ Signature capturée'}
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={clear}
            disabled={isEmpty || disabled}
            className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-md flex items-center gap-1 disabled:opacity-30"
          >
            <Trash2 className="w-3 h-3" />
            Effacer
          </button>
          <button
            type="button"
            onClick={validate}
            disabled={isEmpty || disabled}
            className="px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-md flex items-center gap-1 disabled:opacity-30"
          >
            <Check className="w-3 h-3" />
            Valider
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper : SHA-256 d'une string (utilise Web Crypto API dispo dans tous les navigateurs)
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default SignaturePad;
