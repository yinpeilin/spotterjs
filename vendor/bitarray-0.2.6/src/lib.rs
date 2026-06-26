#![no_std]

use core::{
    fmt,
    hash::{Hash, Hasher},
    ops::{Deref, DerefMut},
};

#[cfg(feature = "space")]
use space::MetricPoint;

/// A constant-sized array of bits. `B` defines the number of bytes.
#[repr(align(64))]
#[derive(Copy, Clone)]
pub struct BitArray<const B: usize> {
    pub bytes: [u8; B],
}

impl<const B: usize> BitArray<B> {
    /// Create a new `BitArray`.
    pub fn new(bytes: [u8; B]) -> Self {
        Self { bytes }
    }

    /// Create a new `BitArray` with all bits set to zero.
    pub fn zeros() -> Self {
        Self { bytes: [0; B] }
    }

    /// Retrieve the byte array.
    pub fn bytes(&self) -> &[u8; B] {
        &self.bytes
    }

    /// Retrieve the mutable byte array.
    pub fn bytes_mut(&mut self) -> &mut [u8; B] {
        &mut self.bytes
    }

    /// Compute the Hamming weight.
    pub fn weight(&self) -> usize {
        self.bytes.iter().map(|b| b.count_ones() as usize).sum()
    }

    /// Compute the Hamming distance to another `BitArray`.
    pub fn distance(&self, other: &Self) -> usize {
        self.bytes
            .iter()
            .copied()
            .zip(other.bytes.iter().copied())
            .map(|(a, b)| (a ^ b).count_ones() as usize)
            .sum()
    }
}

impl<const B: usize> PartialEq for BitArray<B> {
    fn eq(&self, other: &Self) -> bool {
        self.bytes
            .iter()
            .zip(other.bytes.iter())
            .all(|(&a, &b)| a == b)
    }
}

impl<const B: usize> Eq for BitArray<B> {}

impl<const B: usize> fmt::Debug for BitArray<B> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.bytes[..].fmt(f)
    }
}

impl<const B: usize> Hash for BitArray<B> {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.bytes[..].hash(state)
    }
}

impl<const B: usize> Deref for BitArray<B> {
    type Target = [u8; B];

    fn deref(&self) -> &Self::Target {
        &self.bytes
    }
}

impl<const B: usize> DerefMut for BitArray<B> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.bytes
    }
}

#[cfg(feature = "space")]
impl<const B: usize> MetricPoint for BitArray<B> {
    fn distance(&self, rhs: &Self) -> u32 {
        self.distance(rhs) as u32
    }
}
