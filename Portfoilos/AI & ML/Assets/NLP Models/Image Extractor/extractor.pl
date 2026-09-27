#!/usr/bin/env perl
# extractor.pl
# -----------------------------------------------------------------------------
# A THIRD, independent implementation of the same nearest-neighbor OCR demo as
# extractor-engine.js (browser) and extractor_cli.py -- same font data file,
# same fixed-pitch render -> noise -> Hamming-distance classify pipeline, this
# time in Perl (chosen because this module is genuinely text-processing work,
# Perl's home turf). Reads Glyph Library/font-5x7.txt directly, no library
# beyond the Perl core.
#
# Usage:
#   perl extractor.pl "HELLO WORLD"
#   perl extractor.pl "HELLO WORLD" --noise=0.06 --seed=7
#   perl extractor.pl "HELLO WORLD" --save-ppm=out.ppm
#   perl extractor.pl --load-ppm=out.ppm --chars=11
use strict;
use warnings;
use FindBin qw($RealBin);

my $GLYPH_WIDTH  = 5;
my $GLYPH_HEIGHT = 7;
my $GAP          = 1;
my $CELL_WIDTH   = $GLYPH_WIDTH + $GAP;
my $FONT_PATH    = "$RealBin/Glyph Library/font-5x7.txt";

sub load_font {
    open(my $fh, '<', $FONT_PATH) or die "Cannot open $FONT_PATH: $!";
    my @lines = <$fh>;
    chomp @lines;
    close $fh;

    my %glyphs;
    my $i = 0;
    while ($i < scalar(@lines)) {
        my $line = $lines[$i];
        if ($line =~ /^CHAR (.+)$/) {
            my $name = $1;
            my $ch = ($name eq 'SPACE') ? ' ' : $name;
            my @rows = @lines[$i + 1 .. $i + $GLYPH_HEIGHT];
            $glyphs{$ch} = \@rows;
            $i += 1 + $GLYPH_HEIGHT;
        } else {
            $i += 1;
        }
    }
    return \%glyphs;
}

my $GLYPHS = load_font();

my @TEMPLATES;
for my $ch (sort keys %$GLYPHS) {
    my @bits;
    for my $row (@{ $GLYPHS->{$ch} }) {
        push @bits, map { $_ eq '#' ? 1 : 0 } split //, $row;
    }
    push @TEMPLATES, { char => $ch, bits => \@bits };
}

sub render_text {
    my ($text) = @_;
    my @chars = split //, uc($text);
    my $width = @chars * $CELL_WIDTH - $GAP;
    $width = 1 if $width < 1;
    my @grid = map { [ (0) x $width ] } (1 .. $GLYPH_HEIGHT);

    for my $index (0 .. $#chars) {
        my $ch = $chars[$index];
        my $rows = $GLYPHS->{$ch} || $GLYPHS->{' '};
        my $x_offset = $index * $CELL_WIDTH;
        for my $y (0 .. $GLYPH_HEIGHT - 1) {
            my @row_chars = split //, $rows->[$y];
            for my $x (0 .. $GLYPH_WIDTH - 1) {
                $grid[$y][$x_offset + $x] = ($row_chars[$x] eq '#') ? 1 : 0;
            }
        }
    }

    return { width => $width, height => $GLYPH_HEIGHT, grid => \@grid, char_count => scalar(@chars) };
}

sub add_noise {
    my ($rendered, $rate) = @_;
    my @grid = map { [ @$_ ] } @{ $rendered->{grid} };
    for my $y (0 .. $rendered->{height} - 1) {
        for my $x (0 .. $rendered->{width} - 1) {
            if (rand() < $rate) {
                $grid[$y][$x] = $grid[$y][$x] ? 0 : 1;
            }
        }
    }
    return { %$rendered, grid => \@grid };
}

sub slice_cell {
    my ($rendered, $cell_index) = @_;
    my $x_offset = $cell_index * $CELL_WIDTH;
    my @bits;
    for my $y (0 .. $GLYPH_HEIGHT - 1) {
        for my $x (0 .. $GLYPH_WIDTH - 1) {
            push @bits, $rendered->{grid}[$y][$x_offset + $x] ? 1 : 0;
        }
    }
    return \@bits;
}

sub hamming {
    my ($a, $b) = @_;
    my $d = 0;
    for my $i (0 .. $#$a) {
        $d++ if $a->[$i] != $b->[$i];
    }
    return $d;
}

sub classify_cell {
    my ($bits) = @_;
    my ($best_char, $best_dist);
    for my $t (@TEMPLATES) {
        my $d = hamming($bits, $t->{bits});
        if (!defined($best_dist) || $d < $best_dist) {
            $best_char = $t->{char};
            $best_dist = $d;
        }
    }
    return ($best_char, $best_dist);
}

sub extract_text {
    my ($rendered) = @_;
    my @results;
    for my $i (0 .. $rendered->{char_count} - 1) {
        my $bits = slice_cell($rendered, $i);
        my ($char, $dist) = classify_cell($bits);
        push @results, [ $char, $dist ];
    }
    my $text = join('', map { $_->[0] } @results);
    return ($text, \@results);
}

sub print_grid {
    my ($rendered) = @_;
    for my $row (@{ $rendered->{grid} }) {
        print join('', map { $_ ? '#' : '.' } @$row), "\n";
    }
}

sub save_ppm {
    my ($rendered, $path) = @_;
    open(my $fh, '>', $path) or die "Cannot write $path: $!";
    print $fh "P3\n$rendered->{width} $rendered->{height}\n255\n";
    for my $row (@{ $rendered->{grid} }) {
        for my $v (@$row) {
            print $fh $v ? "0 0 0\n" : "255 255 255\n";
        }
    }
    close $fh;
}

sub load_ppm {
    my ($path) = @_;
    open(my $fh, '<', $path) or die "Cannot read $path: $!";
    local $/;
    my $content = <$fh>;
    close $fh;
    my @tokens = split(/\s+/, $content);
    shift @tokens while $tokens[0] eq '';
    die "Only plain P3 PPM files are supported.\n" unless $tokens[0] eq 'P3';
    my ($width, $height, $maxval) = ($tokens[1], $tokens[2], $tokens[3]);
    my @values = @tokens[4 .. $#tokens];
    my @grid = map { [ (0) x $width ] } (1 .. $height);
    my $idx = 0;
    for my $y (0 .. $height - 1) {
        for my $x (0 .. $width - 1) {
            my $r = $values[$idx];
            $idx += 3;
            $grid[$y][$x] = ($r > $maxval / 2) ? 0 : 1;
        }
    }
    return { width => $width, height => $height, grid => \@grid };
}

# --- argument parsing (no library beyond core Perl) -------------------------
my %opt = (noise => 0, seed => undef, save_ppm => undef, load_ppm => undef, chars => undef);
my @positional;
for my $arg (@ARGV) {
    if ($arg =~ /^--noise=(.+)$/)     { $opt{noise} = $1 }
    elsif ($arg =~ /^--seed=(.+)$/)   { $opt{seed} = $1 }
    elsif ($arg =~ /^--save-ppm=(.+)$/) { $opt{save_ppm} = $1 }
    elsif ($arg =~ /^--load-ppm=(.+)$/) { $opt{load_ppm} = $1 }
    elsif ($arg =~ /^--chars=(.+)$/)  { $opt{chars} = $1 }
    else { push @positional, $arg }
}
srand($opt{seed}) if defined $opt{seed};

my $rendered;
if ($opt{load_ppm}) {
    die "--load-ppm requires --chars (how many glyph cells wide the image is).\n" unless $opt{chars};
    $rendered = load_ppm($opt{load_ppm});
    $rendered->{char_count} = $opt{chars};
} else {
    die "Provide TEXT, or use --load-ppm with --chars.\n" unless @positional;
    my $text = join(' ', @positional);
    $rendered = render_text($text);
    $rendered = add_noise($rendered, $opt{noise}) if $opt{noise} > 0;
    if ($opt{save_ppm}) {
        save_ppm($rendered, $opt{save_ppm});
        print "Saved bitmap to $opt{save_ppm}\n";
    }
}

print "Rendered bitmap:\n";
print_grid($rendered);

my ($text, $results) = extract_text($rendered);
print "\nExtracted text: '$text'\n";
print "\nPer-character match distance (0 = exact):\n";
for my $r (@$results) {
    print "  '$r->[0]': distance $r->[1]\n";
}
