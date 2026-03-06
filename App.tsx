import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { generateModelImage, determineModelGender, generateAdsCopy, generateAdImages, generateCaptionAndHashtags, regenerateAdImage, generateTargetMarket } from './services/geminiService';
import type { ImageFile } from './types';
import { LoadingSpinner, CopyIcon, DownloadIcon, VideoIcon } from './components/ui';

// --- HELPER FUNCTIONS ---

const fileToImageFile = (file: File): Promise<ImageFile> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            const parts = result.split(',');
            if (parts.length !== 2) return reject(new Error("Invalid data URL"));
            const mimeType = parts[0].match(/:(.*?);/)?.[1];
            if (!mimeType) return reject(new Error("Could not determine mime type"));
            resolve({ data: parts[1], mimeType, previewUrl: result });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const imageUrlToImageFile = (imageUrl: string): ImageFile => {
    const parts = imageUrl.split(',');
    if (parts.length !== 2) throw new Error("Invalid data URL");
    const mimeType = parts[0].match(/:(.*?);/)?.[1];
    if (!mimeType) throw new Error("Could not determine mime type");
    return { data: parts[1], mimeType, previewUrl: imageUrl };
};

// --- UI COMPONENTS ---

const Header: React.FC = () => (
    <header className="bg-slate-800 border-b border-slate-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-lg flex-shrink-0"></div>
            <h1 className="text-2xl font-bold text-slate-200 tracking-tight">
                STUDIO IKLAN <a href="https://markasai.com/vidabot" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">VIDABOT</a> - Produk Edukasi - Lipsync
            </h1>
        </div>
    </header>
);

const Stepper: React.FC<{ currentStep: number }> = ({ currentStep }) => {
    const steps = ["Kelas/Ecourse", "Model Iklan", "Ads Copy", "Studio Iklan", "Finishing"];
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <ol className="flex items-center w-full">
                {steps.map((label, index) => {
                    const stepNumber = index + 1;
                    const isCompleted = currentStep > stepNumber;
                    const isCurrent = currentStep === stepNumber;
                    return (
                        <li key={label} className={`flex w-full items-center ${stepNumber < steps.length ? "after:content-[''] after:w-full after:h-1 after:border-b after:border-4 after:inline-block" : ""} ${isCompleted ? 'after:border-orange-500' : 'after:border-slate-700'}`}>
                            <div className="flex flex-col items-center justify-center">
                                <span className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${isCurrent || isCompleted ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                    {isCompleted ? (
                                        <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 12"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 5.917 5.724 10.5 15 1.5" /></svg>
                                    ) : (
                                        stepNumber
                                    )}
                                </span>
                                <span className={`mt-2 text-sm font-medium text-center ${isCurrent ? 'text-orange-400' : 'text-slate-400'}`}>{label}</span>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
};

const StepCard: React.FC<{ children: React.ReactNode, title: string }> = ({ children, title }) => (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-slate-200 mb-6">{title}</h2>
        <div className="space-y-6">
            {children}
        </div>
    </div>
);

const ImageUpload: React.FC<{ onUpload: (file: File) => void; currentImage: ImageFile | null; label: string; }> = ({ onUpload, currentImage, label }) => (
    <div>
        <label className="block text-sm font-medium text-slate-200 mb-2">{label}</label>
        <div className="relative w-full h-64 bg-slate-700/50 border-2 border-dashed border-slate-600 rounded-lg flex items-center justify-center hover:border-orange-500 transition-colors">
            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => e.target.files && onUpload(e.target.files[0])} accept="image/*" aria-label={`Upload ${label}`} />
            {currentImage ? <img src={currentImage.previewUrl} alt="Preview" className="object-contain w-full h-full rounded-lg p-1" /> : <span className="text-slate-500">+ Add Image</span>}
        </div>
    </div>
);



// --- STEP COMPONENTS ---

const Step1Product: React.FC<{
    product: { name: string; description: string; targetMarket: string; callToAction: string; duration: number; };
    setProduct: React.Dispatch<React.SetStateAction<any>>;
    onNext: () => void;
}> = ({ product, setProduct, onNext }) => {
    const [error, setError] = useState<string | null>(null);
    const [isRecommending, setIsRecommending] = useState(false);

    const durationPresets = [16, 24, 32, 40];
    const [durationSelectValue, setDurationSelectValue] = useState(() => {
        return durationPresets.includes(product.duration) ? product.duration.toString() : 'manual';
    });

    const handleNext = () => {
        if (!product.name.trim() || !product.callToAction.trim() || product.duration < 8) {
            setError("Harap isi Nama Kelas/Ecourse, Call to Action, dan pastikan durasi minimal 8 detik.");
            return;
        }
        setError(null);
        onNext();
    };
    
    const handleRecommendMarket = async () => {
        if (!product.name && !product.description) {
            setError("Harap isi Nama Kelas dan Deskripsi untuk mendapatkan rekomendasi.");
            return;
        }
        setIsRecommending(true);
        setError(null);
        try {
            const recommendation = await generateTargetMarket(product.name, product.description);
            setProduct(p => ({ ...p, targetMarket: recommendation }));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal mendapatkan rekomendasi.");
        } finally {
            setIsRecommending(false);
        }
    };

    const handleDurationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setDurationSelectValue(value);
        if (value !== 'manual') {
            setProduct(p => ({ ...p, duration: parseInt(value, 10) }));
        }
    };

    const handleManualDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDuration = parseInt(e.target.value, 10) || 0;
        setProduct(p => ({ ...p, duration: newDuration }));
    };

    return (
        <StepCard title="Step 1: Detail Kelas / E-Course">
             <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Nama Kelas / E-Course</label>
                <input
                    type="text"
                    value={product.name}
                    onChange={e => setProduct(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Mahir Digital Marketing dalam 30 Hari"
                    className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Deskripsi Singkat (Opsional)</label>
                <textarea
                    value={product.description}
                    onChange={e => setProduct(p => ({ ...p, description: e.target.value }))}
                    placeholder="e.g., Belajar strategi SEO, SEM, dan social media marketing dari dasar hingga mahir."
                    rows={3}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
            </div>
             <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-200">Target Market (Opsional)</label>
                    <button onClick={handleRecommendMarket} disabled={isRecommending} className="text-sm text-orange-400 hover:underline disabled:opacity-50">
                        {isRecommending ? "Meminta..." : "Rekomendasi AI"}
                    </button>
                </div>
                <textarea
                    value={product.targetMarket}
                    onChange={e => setProduct(p => ({ ...p, targetMarket: e.target.value }))}
                    placeholder="e.g., Mahasiswa, fresh graduate, atau pemilik bisnis kecil yang ingin meningkatkan penjualan online."
                    rows={3}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
            </div>
             <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Call to Action</label>
                <input
                    type="text"
                    value={product.callToAction}
                    onChange={e => setProduct(p => ({ ...p, callToAction: e.target.value }))}
                    placeholder="e.g., Daftar sekarang di website kami!"
                    className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
            </div>
             <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Durasi Video</label>
                <select
                     value={durationSelectValue}
                     onChange={handleDurationChange}
                     className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                 >
                    <option value={16}>16 detik (~2 Narasi)</option>
                    <option value={24}>24 detik (~3 Narasi)</option>
                    <option value={32}>32 detik (~4 Narasi)</option>
                    <option value={40}>40 detik (~5 Narasi)</option>
                    <option value="manual">Input Manual...</option>
                </select>
                {durationSelectValue === 'manual' && (
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-slate-200 mb-2">Durasi Manual (detik)</label>
                        <input
                            type="number"
                            value={product.duration}
                            onChange={handleManualDurationChange}
                            min="8"
                            step="1"
                            placeholder="e.g., 20"
                            className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                         <p className="text-xs text-slate-500 mt-1">
                            Akan menghasilkan ~{Math.ceil(product.duration / 8) || 1} narasi/adegan.
                         </p>
                    </div>
                )}
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={handleNext} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md">Next</button>
        </StepCard>
    );
};

const Step2Model: React.FC<{
    productName: string;
    productDescription: string;
    model: { source: 'manual' | 'ai'; image: ImageFile | null; description: string; };
    setModel: React.Dispatch<React.SetStateAction<any>>;
    setModelGender: (gender: 'male' | 'female') => void;
    onNext: () => void;
    onBack: () => void;
}> = ({ productName, productDescription, model, setModel, setModelGender, onNext, onBack }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerateAIModel = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const imageUrl = await generateModelImage(productName, productDescription, model.description);
            const imageFile = imageUrlToImageFile(imageUrl);
            setModel(m => ({ ...m, image: imageFile }));
            determineModelGender(imageFile).then(setModelGender);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate model.');
        } finally {
            setIsLoading(false);
        }
    }, [productName, productDescription, model.description, setModel, setModelGender]);

    const handleManualUpload = async (file: File) => {
        try {
            const imageFile = await fileToImageFile(file);
            setModel(m => ({ ...m, image: imageFile }));
            determineModelGender(imageFile).then(setModelGender);
        } catch (err) {
            setError("Failed to load image.");
        }
    };

    const handleNext = () => {
        if (!model.image) {
            setError("Please provide a model image.");
            return;
        }
        onNext();
    };

    return (
        <StepCard title="Step 2: Model Iklan">
            <div className="text-center bg-slate-700/50 p-3 rounded-lg">
                <p className="text-sm text-slate-400">Kelas / E-Course</p>
                <p className="font-bold mt-1 text-slate-200">{productName}</p>
            </div>
            <div className="flex justify-center space-x-4">
                {(['ai', 'manual'] as const).map(source => (
                    <button
                        key={source}
                        onClick={() => setModel(m => ({ ...m, source }))}
                        className={`px-6 py-2 rounded-full font-semibold transition-colors ${model.source === source ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                        {source === 'ai' ? 'Rekomendasi AI' : 'Upload Manual'}
                    </button>
                ))}
            </div>

            {model.source === 'ai' && (
                <div className="text-center space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-slate-200 mb-2 text-left">Jelaskan model yang Anda inginkan (Opsional)</label>
                        <textarea
                            value={model.description}
                            onChange={e => setModel(m => ({ ...m, description: e.target.value }))}
                            placeholder="Contoh: Pria Kaukasia, rambut pirang, tersenyum, mengenakan kemeja biru."
                            rows={2}
                            className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                        />
                    </div>

                    {isLoading ? <LoadingSpinner message="Generating AI model..." /> : model.image ? (
                        <img src={model.image.previewUrl} alt="AI Model" className="max-h-64 mx-auto rounded-lg" />
                    ) : <div className="h-64 flex items-center justify-center text-slate-500">Pratinjau model akan muncul di sini</div>}
                    <button onClick={handleGenerateAIModel} disabled={isLoading} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
                        {isLoading ? 'Generating...' : model.image ? 'Regenerate' : 'Generate'}
                    </button>
                </div>
            )}

            {model.source === 'manual' && (
                <ImageUpload label="Foto Model" currentImage={model.image} onUpload={handleManualUpload} />
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex space-x-4">
                <button onClick={onBack} className="w-full bg-slate-600 hover:bg-slate-500 text-slate-200 font-bold py-3 px-4 rounded-lg transition-colors">Back</button>
                <button onClick={handleNext} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md">Next</button>
            </div>
        </StepCard>
    );
};

interface Scene {
    script: string;
}

const Step3AdsCopy: React.FC<{
    product: { name: string; description: string; targetMarket: string; callToAction: string; duration: number; };
    adsCopy: { scenes: Scene[]; };
    setAdsCopy: React.Dispatch<React.SetStateAction<any>>;
    onNext: () => void;
    onBack: () => void;
}> = ({ product, adsCopy, setAdsCopy, onNext, onBack }) => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const numScenes = useMemo(() => Math.max(2, Math.ceil(product.duration / 8)), [product.duration]);

    const handleGenerateScript = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setAdsCopy({ scenes: Array(numScenes).fill({ script: '' }) });
        try {
            const scripts = await generateAdsCopy(product.name, product.description, product.duration, product.callToAction, product.targetMarket);
            setAdsCopy({ scenes: scripts.map(script => ({ script })) });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal membuat naskah.');
        } finally {
            setIsLoading(false);
        }
    }, [product, numScenes, setAdsCopy]);
    
    useEffect(() => {
        if (adsCopy.scenes.length !== numScenes) {
            setAdsCopy({ scenes: Array(numScenes).fill({ script: '' }) });
        }
    }, [numScenes, adsCopy.scenes.length, setAdsCopy]);

    const handleNext = () => {
        if (adsCopy.scenes.some(scene => !scene.script.trim())) {
            setError("Harap isi naskah untuk semua scene terlebih dahulu.");
            return;
        }
        onNext();
    };

    const getSceneLabel = (index: number) => {
        if (index === 0) return `Narasi Scene 1 (Hook)`;
        if (index === numScenes - 1) return `Narasi Scene ${numScenes} (CTA)`;
        return `Narasi Scene ${index + 1}`;
    };

    return (
        <StepCard title="Step 3: Ads Copy">
            <button onClick={handleGenerateScript} disabled={isLoading} className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition-colors shadow-md">
                {isLoading ? 'Menulis...' : adsCopy.scenes[0]?.script ? 'Buat Ulang Naskah' : 'Buat Naskah Iklan'}
            </button>

            {isLoading && <LoadingSpinner message="Menulis naskah iklan..." />}
            
            {!isLoading && adsCopy.scenes[0]?.script && (
                <div className="space-y-6 border-t border-slate-700 pt-6">
                    {adsCopy.scenes.map((scene, index) => (
                        <div key={index} className="space-y-2">
                             <div>
                                <label className="block text-sm font-medium text-slate-200 mb-2">{getSceneLabel(index)}</label>
                                <textarea
                                    value={scene.script}
                                    onChange={e => {
                                        const newScript = e.target.value;
                                        setAdsCopy(ac => {
                                            const newScenes = [...ac.scenes];
                                            newScenes[index] = { ...newScenes[index], script: newScript };
                                            return { ...ac, scenes: newScenes };
                                        });
                                    }}
                                    rows={4}
                                    className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
                                />
                                <div className="flex justify-between items-center mt-1">
                                    <p className="text-xs text-slate-500">~13-16 words recommended</p>
                                    <p className="text-xs text-slate-400 text-right">{scene.script.split(/\s+/).filter(Boolean).length} words</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex space-x-4 pt-4 border-t border-slate-700">
                <button onClick={onBack} className="w-full bg-slate-600 hover:bg-slate-500 text-slate-200 font-bold py-3 px-4 rounded-lg transition-colors">Back</button>
                <button onClick={handleNext} disabled={isLoading || adsCopy.scenes.some(s => !s.script.trim())} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
            </div>
        </StepCard>
    );
};

const Step4Studio: React.FC<{
    modelImage: ImageFile;
    productName: string;
    adsCopyScenes: Scene[];
    modelGender: 'male' | 'female';
    studio: { adImages: string[]; };
    setStudio: React.Dispatch<React.SetStateAction<any>>;
    onNext: () => void;
    onBack: () => void;
}> = ({ modelImage, productName, adsCopyScenes, modelGender, studio, setStudio, onNext, onBack }) => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [regeneratingImageIndex, setRegeneratingImageIndex] = useState<number | null>(null);
    
    const [shootingLocation, setShootingLocation] = useState('di dalam kelas modern');
    const [locationSelection, setLocationSelection] = useState('di dalam kelas modern');

    const [showVideoPrompts, setShowVideoPrompts] = useState<boolean[]>(adsCopyScenes.map(() => false));
    const [videoPrompts, setVideoPrompts] = useState<string[]>(adsCopyScenes.map(() => ''));
    const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null);

    const locationOptions = [
        { value: 'di dalam kelas modern', label: 'Kelas Modern' },
        { value: 'di cafe yang nyaman', label: 'Cafe' },
        { value: 'di kantor profesional', label: 'Kantor' },
        { value: 'di rumah minimalis', label: 'Rumah' },
        { value: 'di studio dengan latar belakang putih polos', label: 'Studio (Polos)' },
        { value: 'di luar ruangan seperti taman atau perkotaan', label: 'Luar Ruangan' },
        { value: 'manual', label: 'Lainnya (Input Manual)' }
    ];

    const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setLocationSelection(value);
        if (value !== 'manual') {
            setShootingLocation(value);
        } else {
            setShootingLocation('');
        }
    };

    useEffect(() => {
        if (adsCopyScenes.length > 0) {
            const pronoun = modelGender === 'male' ? 'He' : 'She';
            const defaultPrompts = adsCopyScenes.map(scene =>
                `${pronoun} Lipsync in Indonesian "${scene.script}" No extra words.\n\nnegative prompt: translate in english, subtitle, text overlay`
            );
            setVideoPrompts(defaultPrompts);
            setShowVideoPrompts(adsCopyScenes.map(() => false));
        }
    }, [adsCopyScenes, modelGender]);

    const adImagePrompts = useMemo(() => {
        if (adsCopyScenes.length === 0) return [];
        return adsCopyScenes.map((scene, index) => {
            let sceneDescription = '';
            if (index === 0) {
                sceneDescription = `The model has just discovered the e-course "${productName}" and looks intrigued and excited. This shot matches the ad script's hook: "${scene.script}".`;
            } else if (index === adsCopyScenes.length - 1) {
                sceneDescription = `The model looks confident and satisfied after taking the course, and is recommending it to the viewer, matching the call-to-action: "${scene.script}".`;
            } else {
                sceneDescription = `The model is actively engaged in learning, perhaps looking at a screen or taking notes, showing concentration and satisfaction. This scene illustrates the script: "${scene.script}".`;
            }
            return `Generate a photorealistic, 9:16 UGC-style image. The setting is a ${shootingLocation}. The image features the **exact same person** from the model image, wearing the **exact same outfit**. ${sceneDescription} IMPORTANT: The image must be high quality and realistic. No text or logos. The person and outfit must be identical to the input model image.`;
        });
    }, [productName, adsCopyScenes, shootingLocation]);

    const handleGenerateImages = useCallback(async () => {
        if (!shootingLocation.trim()) {
            setError("Harap tentukan lokasi syuting.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setStudio({ adImages: [] });
        try {
            setLoadingMessage('Membuat adegan iklan sesuai naskah...');
            const scripts = adsCopyScenes.map(s => s.script);
            const images = await generateAdImages(modelImage, scripts, productName, shootingLocation);
            setStudio(s => ({ ...s, adImages: images }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal membuat gambar.');
        } finally {
            setIsLoading(false);
        }
    }, [modelImage, adsCopyScenes, productName, shootingLocation, setStudio]);

    const handleRegenerateImage = useCallback(async (indexToRegen: number) => {
        setRegeneratingImageIndex(indexToRegen);
        setError(null);
        try {
            const prompt = adImagePrompts[indexToRegen];
            const newImageUrl = await regenerateAdImage(modelImage, prompt);
            setStudio(s => {
                const newAdImages = [...s.adImages];
                newAdImages[indexToRegen] = newImageUrl;
                return { ...s, adImages: newAdImages };
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal membuat ulang gambar.');
        } finally {
            setRegeneratingImageIndex(null);
        }
    }, [modelImage, adImagePrompts, setStudio]);
    
    const handleDownloadFrame = (index: number) => {
        const imageUrl = studio.adImages[index];
        if (!imageUrl) return;
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `vidabot-adegan-${index + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const toggleVideoPrompt = (index: number) => {
        setShowVideoPrompts(prev => {
            const newState = [...prev];
            newState[index] = !newState[index];
            return newState;
        });
    };

    const handleVideoPromptChange = (index: number, value: string) => {
        setVideoPrompts(prev => {
            const newState = [...prev];
            newState[index] = value;
            return newState;
        });
    };

    const handleCopyPrompt = (index: number) => {
        if(!videoPrompts[index]) return;
        navigator.clipboard.writeText(videoPrompts[index]);
        setCopiedPromptIndex(index);
        setTimeout(() => setCopiedPromptIndex(null), 2000);
    };

    const handleNext = () => {
        if (studio.adImages.length < adsCopyScenes.length) {
            setError(`Harap buat semua (${adsCopyScenes.length}) adegan gambar terlebih dahulu.`);
            return;
        }
        onNext();
    };

    const isBusy = isLoading || regeneratingImageIndex !== null;

    return (
        <StepCard title="Step 4: Studio Iklan">
            <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Lokasi Syuting</label>
                <select
                    value={locationSelection}
                    onChange={handleLocationChange}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                    {locationOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                {locationSelection === 'manual' && (
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-slate-200 mb-2">Lokasi Manual</label>
                        <input
                            type="text"
                            value={shootingLocation}
                            onChange={e => setShootingLocation(e.target.value)}
                            placeholder="e.g., di perpustakaan kota"
                            className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </div>
                )}
            </div>
            <div className="text-center">
                <button onClick={handleGenerateImages} disabled={isBusy} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition-colors shadow-md">
                    {isLoading ? 'Membuat Adegan...' : studio.adImages.length > 0 ? `Buat Ulang ${adsCopyScenes.length} Adegan` : `Buat ${adsCopyScenes.length} Adegan Iklan`}
                </button>
            </div>
            {isLoading && <LoadingSpinner message={loadingMessage} />}
            {studio.adImages.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {studio.adImages.map((src, i) => (
                        <div key={i} className="bg-slate-800/50 rounded-lg p-3 space-y-3 border border-slate-700">
                             <div className="relative w-full aspect-[9/16]">
                                <img src={src} alt={`Ad scene ${i+1}`} className="rounded-lg w-full h-full object-cover" />
                            </div>
                            <button
                                onClick={() => handleRegenerateImage(i)}
                                disabled={isBusy}
                                className="w-full text-sm bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-3 rounded-lg disabled:opacity-50"
                            >
                                {regeneratingImageIndex === i ? 'Regenerating...' : 'Regenerate Frame'}
                            </button>
                            <div className="border-t border-b border-slate-700 py-3 space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-semibold">Image-to-Video Prompt</label>
                                    <button onClick={() => toggleVideoPrompt(i)} className="text-sm text-orange-400 hover:underline">
                                        {showVideoPrompts[i] ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                                {showVideoPrompts[i] && (
                                    <textarea
                                        value={videoPrompts[i]}
                                        onChange={(e) => handleVideoPromptChange(i, e.target.value)}
                                        rows={6}
                                        className="w-full text-sm bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
                                        placeholder="Enter prompt to animate the image..."
                                    />
                                )}
                            </div>
                            <div className="flex justify-around items-center">
                                <button onClick={() => handleCopyPrompt(i)} disabled={isBusy || !videoPrompts[i]} className="flex flex-col items-center text-xs text-slate-400 hover:text-white disabled:opacity-50 transition-colors">
                                    <CopyIcon className="w-5 h-5 mb-1" />
                                    <span>{copiedPromptIndex === i ? 'Copied!' : 'Copy'}</span>
                                </button>
                                <button onClick={() => handleDownloadFrame(i)} disabled={isBusy} className="flex flex-col items-center text-xs text-slate-400 hover:text-white disabled:opacity-50 transition-colors">
                                    <DownloadIcon className="w-5 h-5 mb-1" />
                                    <span>Frame</span>
                                </button>
                                <a href="https://vidabot.markasai.com/generate-veo3" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center text-xs text-slate-400 hover:text-white transition-colors">
                                    <VideoIcon className="w-5 h-5 mb-1" />
                                    <span>Vidabot</span>
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex space-x-4 pt-6 mt-6 border-t border-slate-700">
                <button onClick={onBack} className="w-full bg-slate-600 hover:bg-slate-500 text-slate-200 font-bold py-3 px-4 rounded-lg transition-colors">Back</button>
                <button onClick={handleNext} disabled={isBusy || studio.adImages.length < adsCopyScenes.length} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md disabled:opacity-50">Next</button>
            </div>
        </StepCard>
    );
};


const Step5Finishing: React.FC<{
    adImages: string[];
    productName: string;
    productDescription: string;
    onBack: () => void;
    onReset: () => void;
}> = ({ adImages, productName, productDescription, onBack, onReset }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [captionData, setCaptionData] = useState<{ caption: string, hashtags: string } | null>(null);
    const [isCopying, setIsCopying] = useState(false);

    const handleGenerateCaptions = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const captions = await generateCaptionAndHashtags(productName, productDescription);
            setCaptionData(captions);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal membuat caption.");
        } finally {
            setIsLoading(false);
        }
    }, [productName, productDescription]);

    const handleCopy = () => {
        if (!captionData) return;
        const textToCopy = `${captionData.caption}\n\n${captionData.hashtags}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            setIsCopying(true);
            setTimeout(() => setIsCopying(false), 2000);
        });
    };

    const handleDownload = async () => {
        if (!captionData) return;

        // Download caption
        const textContent = `${captionData.caption}\n\n${captionData.hashtags}`;
        const textBlob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const textUrl = URL.createObjectURL(textBlob);
        const textLink = document.createElement('a');
        textLink.href = textUrl;
        textLink.download = 'vidabot-caption.txt';
        document.body.appendChild(textLink);
        textLink.click();
        document.body.removeChild(textLink);
        URL.revokeObjectURL(textUrl);

        // Download images sequentially
        for (let i = 0; i < adImages.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 300));
            const imageLink = document.createElement('a');
            imageLink.href = adImages[i];
            imageLink.download = `vidabot-adegan-${i + 1}.png`;
            document.body.appendChild(imageLink);
            imageLink.click();
            document.body.removeChild(imageLink);
        }
    };

    return (
        <StepCard title="Step 5: Finishing">
            <h3 className="text-center font-bold text-lg text-slate-200">Pratinjau Adegan Iklan Anda</h3>
            <div className="grid grid-cols-3 gap-2">
                {adImages.map((src, i) => (
                    <img key={i} src={src} alt={`Ad scene ${i+1}`} className="rounded-lg w-full aspect-[9/16] object-cover" />
                ))}
            </div>

            {!captionData && !isLoading && (
                 <div className="text-center pt-4">
                    <button onClick={handleGenerateCaptions} disabled={isLoading} className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md">
                        {isLoading ? 'Membuat...' : 'Buat Caption & Hashtag'}
                    </button>
                </div>
            )}
           
            {isLoading && <LoadingSpinner message={"Membuat caption & hashtag..."} />}

            {captionData && (
                <div className="space-y-4 pt-4 border-t border-slate-700">
                     <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
                        <p className="text-slate-300 whitespace-pre-wrap">{captionData.caption}</p>
                        <p className="text-orange-400 font-semibold">{captionData.hashtags}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={handleCopy} className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded-lg">
                            {isCopying ? 'Copied!' : 'Copy Text'}
                        </button>
                         <button onClick={handleDownload} className="w-full inline-flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                            Simpan Semua
                        </button>
                    </div>
                </div>
            )}

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <div className="flex space-x-4 pt-4 border-t border-slate-700">
                <button onClick={onBack} className="w-1/2 bg-slate-600 hover:bg-slate-500 text-slate-200 font-bold py-3 px-4 rounded-lg transition-colors">Back</button>
                <button onClick={onReset} className="w-1/2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">Buat Iklan Lagi</button>
            </div>
        </StepCard>
    );
};


// --- MAIN APP COMPONENT ---

type ProductState = {
    name: string;
    description: string;
    targetMarket: string;
    callToAction: string;
    duration: number;
}

import { config } from './src/config';

const Footer: React.FC = () => (
    <footer className="py-6 text-center text-slate-500 text-sm border-t border-slate-800 mt-8">
        <p>&copy; {new Date().getFullYear()} Vidabot AI. All rights reserved.</p>
        <p className="text-xs mt-1 opacity-50">
            Running on {config.platform}
        </p>
    </footer>
);

const App: React.FC = () => {
    const initialProductState: ProductState = { name: '', description: '', targetMarket: '', callToAction: '', duration: 24 };
    const initialModelState = { source: 'ai' as 'manual' | 'ai', image: null, description: '' };
    const initialAdsCopyState = { scenes: [] };
    const initialStudioState = { adImages: [] };

    const [currentStep, setCurrentStep] = useState(1);
    const [product, setProduct] = useState<ProductState>(initialProductState);
    const [model, setModel] = useState<{ source: 'manual' | 'ai'; image: ImageFile | null; description: string; }>(initialModelState);
    const [modelGender, setModelGender] = useState<'male' | 'female'>('female');
    const [adsCopy, setAdsCopy] = useState<{ scenes: { script: string }[] }>(initialAdsCopyState);
    const [studio, setStudio] = useState<{ adImages: string[]; }>(initialStudioState);



    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 5));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
    const resetState = () => {
        setProduct(initialProductState);
        setModel(initialModelState);
        setAdsCopy(initialAdsCopyState);
        setStudio(initialStudioState);
        setCurrentStep(1);
    };

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 1:
                return <Step1Product product={product} setProduct={setProduct} onNext={nextStep} />;
            case 2:
                return <Step2Model
                    productName={product.name}
                    productDescription={product.description}
                    model={model}
                    setModel={setModel}
                    setModelGender={setModelGender}
                    onNext={nextStep}
                    onBack={prevStep}
                />;
            case 3:
                if (!model.image) {
                    setCurrentStep(2);
                    return null;
                }
                return <Step3AdsCopy
                    product={product}
                    adsCopy={adsCopy}
                    setAdsCopy={setAdsCopy}
                    onNext={nextStep}
                    onBack={prevStep}
                />;
            case 4:
                if (!model.image || adsCopy.scenes.some(s => !s.script)) {
                    setCurrentStep(3);
                    return null;
                }
                return <Step4Studio
                    modelImage={model.image}
                    productName={product.name}
                    adsCopyScenes={adsCopy.scenes}
                    modelGender={modelGender}
                    studio={studio}
                    setStudio={setStudio}
                    onNext={nextStep}
                    onBack={prevStep}
                />;
            case 5:
                 if (studio.adImages.length < adsCopy.scenes.length) {
                    setCurrentStep(4);
                    return null;
                }
                return <Step5Finishing
                    adImages={studio.adImages}
                    productName={product.name}
                    productDescription={product.description}
                    onBack={prevStep}
                    onReset={resetState}
                />;
            default:
                return <Step1Product product={product} setProduct={setProduct} onNext={nextStep} />;
        }
    };
    
    const renderContent = () => {
        return (
            <>
                <Stepper currentStep={currentStep} />
                {renderCurrentStep()}
            </>
        )
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-900">
            <Header />
            <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                <div className="max-w-2xl mx-auto">
                    {renderContent()}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default App;