const { Jimp, rgbaToInt, intToRGBA } = require("jimp");

async function main() {
    // Read the image
    const image = await Jimp.read("logo.jpeg");
    
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        // Get the RGBA values from the image buffer
        const red = this.bitmap.data[idx + 0];
        const green = this.bitmap.data[idx + 1];
        const blue = this.bitmap.data[idx + 2];
        const alpha = this.bitmap.data[idx + 3];

        // If the pixel is very light (close to white), make it transparent
        // A simple threshold: if R > 230 and G > 230 and B > 230
        if (red > 220 && green > 220 && blue > 220) {
            // Anti-aliasing logic for smooth edges:
            // Calculate how "white" the pixel is (255 is pure white)
            const whiteness = Math.min(red, green, blue);
            
            // Map 220->255 to alpha 255->0
            // If whiteness is 255, alpha is 0. If whiteness is 220, alpha is 255.
            const newAlpha = Math.floor(255 * (255 - whiteness) / 35);
            
            this.bitmap.data[idx + 3] = newAlpha;
        }
    });

    await image.write("logo-glow.png");
    console.log("Image saved as logo-glow.png");
}

main().catch(console.error);
