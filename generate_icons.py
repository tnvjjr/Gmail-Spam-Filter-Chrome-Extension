from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size):
    # Create a new image with a white background
    icon = Image.new('RGBA', (size, size), 'white')
    draw = ImageDraw.Draw(icon)
    
    # Draw a shield shape
    margin = size // 8
    shield_width = size - (2 * margin)
    shield_height = size - (2 * margin)
    
    # Shield background (light blue)
    shield_points = [
        (margin, margin + shield_height//4),  # Top left
        (margin + shield_width//2, margin),   # Top middle
        (margin + shield_width, margin + shield_height//4),  # Top right
        (margin + shield_width, margin + shield_height//2),  # Middle right
        (margin + shield_width//2, margin + shield_height),  # Bottom middle
        (margin, margin + shield_height//2),  # Middle left
    ]
    draw.polygon(shield_points, fill='#4285f4')  # Google Blue
    
    # Draw an envelope symbol in white
    envelope_margin = size // 4
    envelope_width = size - (2 * envelope_margin)
    envelope_height = envelope_width * 0.6
    
    # Envelope base points
    envelope_points = [
        (envelope_margin, envelope_margin + envelope_height * 0.3),  # Top left
        (envelope_margin + envelope_width//2, envelope_margin + envelope_height * 0.6),  # Middle
        (envelope_margin + envelope_width, envelope_margin + envelope_height * 0.3),  # Top right
        (envelope_margin + envelope_width, envelope_margin + envelope_height),  # Bottom right
        (envelope_margin, envelope_margin + envelope_height),  # Bottom left
    ]
    draw.polygon(envelope_points, fill='white')
    
    # Draw the top flap of the envelope
    flap_points = [
        (envelope_margin, envelope_margin + envelope_height * 0.3),  # Bottom left
        (envelope_margin + envelope_width//2, envelope_margin),  # Top middle
        (envelope_margin + envelope_width, envelope_margin + envelope_height * 0.3),  # Bottom right
    ]
    draw.polygon(flap_points, fill='#EA4335')  # Google Red
    
    # Add a small exclamation mark
    if size >= 48:  # Only for larger icons
        exclamation_color = '#FBBC05'  # Google Yellow
        mark_width = size // 16
        mark_height = size // 8
        mark_x = size - mark_width * 2
        mark_y = size - mark_height * 2
        
        # Exclamation point dot
        draw.ellipse([mark_x, mark_y + mark_height * 1.2, 
                     mark_x + mark_width, mark_y + mark_height * 1.4], 
                    fill=exclamation_color)
        
        # Exclamation point line
        draw.rectangle([mark_x, mark_y, 
                       mark_x + mark_width, mark_y + mark_height * 0.9], 
                      fill=exclamation_color)
    
    return icon

def main():
    # Create icons directory if it doesn't exist
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Generate icons of different sizes
    sizes = [16, 48, 128]
    for size in sizes:
        icon = create_icon(size)
        icon_path = os.path.join(script_dir, f'icon{size}.png')
        icon.save(icon_path, 'PNG')
        print(f'Generated {icon_path}')

if __name__ == '__main__':
    main()
