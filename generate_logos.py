import os
from PIL import Image, ImageDraw

def generate_svg():
    # We will output clean SVGs with a transparent background
    svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <!-- White Roof Chevron -->
  <path d="M 21.5 67 L 58.5 30 L 76.5 48 L 67.1 48 L 58.5 39.4 L 30.9 67 Z" fill="#FFFFFF" />

  <!-- Orange Solar Panels -->
  <!-- Top-Left Panel -->
  <polygon points="55,49 65.5,49 57.5,57 47,57" fill="#FF6600" />
  
  <!-- Top-Right Panel -->
  <polygon points="67.5,49 78,49 70,57 59.5,57" fill="#FF6600" />
  
  <!-- Bottom-Left Panel -->
  <polygon points="47,59 57.5,59 49.5,67 39,67" fill="#FF6600" />
</svg>"""

    favicon_content = svg_content
    
    with open("public/logo.svg", "w", encoding="utf-8") as f:
        f.write(svg_content)
    
    with open("public/favicon.svg", "w", encoding="utf-8") as f:
        f.write(favicon_content)

def generate_png():
    # Generate a high-resolution 512x512 logo image with a black background matching the user's design
    size = 512
    scale = 5.12
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # White Roof Chevron
    roof_coords = [
        (21.5 * scale, 67 * scale),
        (58.5 * scale, 30 * scale),
        (76.5 * scale, 48 * scale),
        (67.1 * scale, 48 * scale),
        (58.5 * scale, 39.4 * scale),
        (30.9 * scale, 67 * scale)
    ]
    draw.polygon(roof_coords, fill=(255, 255, 255, 255))

    # Orange Panels
    # Top-Left Panel
    tl_coords = [
        (55 * scale, 49 * scale),
        (65.5 * scale, 49 * scale),
        (57.5 * scale, 57 * scale),
        (47 * scale, 57 * scale)
    ]
    draw.polygon(tl_coords, fill=(255, 102, 0, 255))

    # Top-Right Panel
    tr_coords = [
        (67.5 * scale, 49 * scale),
        (78 * scale, 49 * scale),
        (70 * scale, 57 * scale),
        (59.5 * scale, 57 * scale)
    ]
    draw.polygon(tr_coords, fill=(255, 102, 0, 255))

    # Bottom-Left Panel
    bl_coords = [
        (47 * scale, 59 * scale),
        (57.5 * scale, 59 * scale),
        (49.5 * scale, 67 * scale),
        (39 * scale, 67 * scale)
    ]
    draw.polygon(bl_coords, fill=(255, 102, 0, 255))

    # Save output
    img.save("public/logo.png", "PNG")

if __name__ == "__main__":
    generate_svg()
    generate_png()
    print("Logos successfully generated!")
