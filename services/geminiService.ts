import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { ImageFile } from '../types';
import { processAudio } from './audioService';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type ImageData = {
    data: string;
    mimeType: string;
}

const extractImageUrl = (response: any): string => {
    if (response.promptFeedback?.blockReason) {
        throw new Error(`Request was blocked: ${response.promptFeedback.blockReason}`);
    }
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
        throw new Error("Invalid response from the model. No content parts found.");
    }
    for (const part of candidate.content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            const mimeType = part.inlineData.mimeType;
            return `data:${mimeType};base64,${base64ImageBytes}`;
        }
    }
    const textResponse = candidate.content.parts.find((p: any) => p.text)?.text;
    if (textResponse) {
        console.error("Model returned text instead of an image:", textResponse);
        throw new Error(`The model returned a text response but no image.`);
    }
    throw new Error("No image was generated in the response.");
};

export const generateTargetMarket = async (courseName: string, courseDescription: string): Promise<string> => {
    try {
        const prompt = `Based on the e-course titled "${courseName}" (Description: "${courseDescription}"), describe the ideal target market in 2-3 sentences in Indonesian. The tone should be for marketing strategy. Example: "Kursus ini cocok untuk profesional muda usia 25-35 yang ingin memajukan karir di bidang pemasaran digital. Mereka ambisius, melek teknologi, dan bersemangat mempelajari keterampilan baru agar tetap kompetitif."`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error generating target market:", error);
        throw new Error("Failed to generate target market recommendation.");
    }
};


export const generateModelImage = async (productName: string, productDescription: string, modelDescription?: string): Promise<string> => {
    try {
        const modelPrompt = modelDescription
            ? modelDescription
            : "a friendly, relatable, and professional-looking instructor for an online course.";

        const textPart = { text: `For an e-course titled "${productName}" (Description: "${productDescription}"), generate a single, photorealistic, portrait-style (9:16) image. The image should feature a model who looks like: ${modelPrompt}. The background should be a simple, clean studio setting, suitable for professional headshots. IMPORTANT: The image must NOT contain any text, letters, or logos.` };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        return extractImageUrl(response);
    } catch (error) {
        console.error("Error generating model image:", error);
        if (error instanceof Error) throw error;
        throw new Error("An unknown error occurred while generating the model image.");
    }
};

export const determineModelGender = async (modelImage: ImageData): Promise<'male' | 'female'> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { data: modelImage.data, mimeType: modelImage.mimeType } },
                    { text: "Analyze the person in this image. Is the person male or female? Respond with only the word 'male' or 'female', with no other text or punctuation." }
                ]
            },
        });
        const gender = response.text.trim().toLowerCase();
        if (gender === 'male') {
            return 'male';
        }
        // Default to female if detection fails or returns something else
        return 'female';
    } catch (error) {
        console.error("Error determining model gender:", error);
        return 'female'; // Default on error
    }
};

export const generateAdsCopy = async (productName: string, productDescription: string, duration: number, callToAction: string, targetMarket: string): Promise<string[]> => {
    try {
        const numScenes = Math.max(2, Math.ceil(duration / 8));
        const middleScenesCount = numScenes - 2;
        const middleScenesPrompt = middleScenesCount > 0
            ? `The ${middleScenesCount} middle scene(s) should focus on the benefits, emotions, or key learnings, targeting this audience: ${targetMarket || 'a general audience'}.`
            : '';

        const prompt = `Create an ad script for a TikTok video about an e-course: "${productName}" (Description: "${productDescription}"). The script must be in Indonesian. The tone must be casual and engaging.
The script must be divided into exactly ${numScenes} parts:
1. Scene 1 (Hook): A compelling opening to grab attention.
${middleScenesPrompt}
2. Final Scene (CTA): A clear call to action, incorporating this user-provided goal: "${callToAction}".

Each scene's script must be between 13 and 16 words long.
Provide the script for each scene as a string in a JSON array of exactly ${numScenes} strings.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING,
                    }
                }
            }
        });
        
        const scripts = JSON.parse(response.text);

        if (!Array.isArray(scripts) || scripts.length !== numScenes || !scripts.every(s => typeof s === 'string')) {
            throw new Error(`Invalid response format from AI. Expected a JSON array of ${numScenes} strings, but got ${scripts.length}.`);
        }
        
        return scripts;
    } catch (error) {
        console.error("Error generating ads copy:", error);
        if (error instanceof Error) throw error;
        throw new Error("An unknown error occurred while generating the ads copy.");
    }
};


export const generateSpeech = async (
    text: string,
    voiceName: string,
    style: string,
    onProgress: (message: string) => void
): Promise<string> => {
    try {
        const language = 'id-ID';
        onProgress("Giving directions to the AI Actor...");

        const languageNames: { [key: string]: string } = { "id-ID": "Indonesia" };
        const stylePrompts: { [key: string]: (text: string, langName: string) => string } = {
            santai: (text, langName) => `Say this casually in ${langName} with a relaxed, easygoing vibe: "${text}"`,
            enerjik: (text, langName) => `Say this enthusiastically in ${langName} with an upbeat and energetic tone, perfect for an exciting ad: "${text}"`,
            profesional: (text, langName) => `Say this clearly and confidently in ${langName} with a professional and trustworthy tone: "${text}"`,
        };

        const langName = languageNames[language] || language;
        const promptFn = stylePrompts[style] || stylePrompts.santai;
        let finalPrompt = promptFn(text, langName);

        onProgress("Recording session in progress...");
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text: finalPrompt }] },
            config: {
                // @ts-ignore
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName }
                    }
                }
            }
        });

        const candidate = response.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        const audioData = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType;

        if (!audioData || !mimeType?.startsWith("audio/")) {
            throw new Error("Invalid audio data received from the API.");
        }

        onProgress("Mixing and mastering audio...");
        const audioUrl = await processAudio(audioData, mimeType, style, voiceName);
        onProgress("Finished!");
        return audioUrl;

    } catch (error) {
        console.error("Error generating speech:", error);
        if (error instanceof Error) throw new Error(`Failed to generate audio: ${error.message}`);
        throw new Error("An unknown error occurred while generating the audio.");
    }
};

export const generateAdImages = async (modelImage: ImageData, adScripts: string[], productName: string, shootingLocation: string): Promise<string[]> => {
    try {
        if (!adScripts || adScripts.length === 0) {
            throw new Error("generateAdImages requires at least one ad script.");
        }
        
        const prompts = adScripts.map((script, index) => {
            let sceneDescription = '';
            if (index === 0) {
                sceneDescription = `The model has just discovered the e-course "${productName}" and looks intrigued and excited. This shot matches the ad script's hook: "${script}".`;
            } else if (index === adScripts.length - 1) {
                sceneDescription = `The model looks confident and satisfied after taking the course, and is recommending it to the viewer, matching the call-to-action: "${script}".`;
            } else {
                sceneDescription = `The model is actively engaged in learning, perhaps looking at a screen or taking notes, showing concentration and satisfaction. This scene illustrates the script: "${script}".`;
            }

            return `Generate a photorealistic, 9:16 UGC-style image. The setting is a ${shootingLocation}. The image features the **exact same person** from the model image, wearing the **exact same outfit**. ${sceneDescription} IMPORTANT: The image must be high quality and realistic. No text or logos. The person and outfit must be identical to the input model image.`;
        });

        const imageGenerationPromises = prompts.map(async (prompt) => {
            const modelImagePart = { inlineData: { data: modelImage.data, mimeType: modelImage.mimeType } };
            const textPart = { text: prompt };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [modelImagePart, textPart] },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            return extractImageUrl(response);
        });

        return await Promise.all(imageGenerationPromises);
    } catch (error) {
        console.error("Error generating ad images:", error);
        if (error instanceof Error) throw error;
        throw new Error("An unknown error occurred while generating ad images.");
    }
};

export const regenerateAdImage = async (
    modelImage: ImageData,
    prompt: string
): Promise<string> => {
     try {
        const modelImagePart = { inlineData: { data: modelImage.data, mimeType: modelImage.mimeType } };
        const textPart = { text: prompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [modelImagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        return extractImageUrl(response);
    } catch (error) {
        console.error("Error regenerating ad image:", error);
        if (error instanceof Error) throw error;
        throw new Error("An unknown error occurred while regenerating ad image.");
    }
};


export const generateVideo = async (
    prompt: string,
    image: ImageData,
    onProgress: (message: string) => void
): Promise<string> => {
    try {
        onProgress("Initiating video generation...");

        let operation = await ai.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: prompt,
            image: {
                imageBytes: image.data,
                mimeType: image.mimeType,
            },
            config: {
                numberOfVideos: 1,
                aspectRatio: '9:16',
            }
        });

        onProgress("Processing video... this may take a few minutes.");

        const messages = [
            "Analyzing prompt and image...",
            "Composing video frames...",
            "Rendering video, this can take a while...",
            "Almost there...",
            "Finalizing the video..."
        ];
        let pollCount = 0;

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            onProgress(messages[pollCount % messages.length]);
            pollCount++;
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        if (operation.error) {
            throw new Error(`Video generation failed: ${operation.error.message}`);
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

        if (!downloadLink) {
            throw new Error("Video generation completed, but no download link was found.");
        }

        onProgress("Downloading generated video...");

        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.statusText}`);
        }

        const videoBlob = await videoResponse.blob();
        return URL.createObjectURL(videoBlob);

    } catch (error) {
        console.error("Error generating video:", error);
        if (error instanceof Error) throw new Error(`Failed to generate video: ${error.message}`);
        throw new Error("An unknown error occurred while generating the video.");
    }
};

export const generateCaptionAndHashtags = async (productName: string, productDescription: string): Promise<{ caption: string, hashtags: string }> => {
    try {
        const prompt = `Based on the product "${productName}" (Description: "${productDescription}"), create content for a TikTok post in Indonesian.
1.  **Caption:** A short, catchy, and engaging caption (max 150 characters) that creates curiosity and encourages comments.
2.  **Hashtags:** Exactly 5 hashtags. Mix relevant product keywords with currently trending but related hashtags to maximize reach and viral potential.

Format the output as follows, with no extra text or explanation:
Caption: [Your caption here]
Hashtags: [Your hashtags here]`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const text = response.text;
        const captionMatch = text.match(/Caption: (.*)/);
        const hashtagsMatch = text.match(/Hashtags: (.*)/);

        const caption = captionMatch ? captionMatch[1].trim() : "Check this out!";
        const hashtags = hashtagsMatch ? hashtagsMatch[1].trim() : "#fyp #racuntiktok";

        return { caption, hashtags };
    } catch (error) {
        console.error("Error generating caption and hashtags:", error);
        return {
            caption: `Wajib coba ${productName}! ✨`,
            hashtags: "#fyp #racuntiktok #productreview #xyzbca #tiktokmademebuyit"
        };
    }
};