package com.supplylink.common;

public class BusinessException extends RuntimeException {
    private final int status;
    private Object licenseStatus;

    public BusinessException(String message, int status) {
        super(message);
        this.status = status;
    }

    public BusinessException(String message) {
        this(message, 400);
    }

    public int getStatus() { return status; }

    public Object getLicenseStatus() { return licenseStatus; }
    public void setLicenseStatus(Object licenseStatus) { this.licenseStatus = licenseStatus; }
}
