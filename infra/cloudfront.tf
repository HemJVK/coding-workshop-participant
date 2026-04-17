resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "s3-oac-${local.app_id}"
  description                       = "OAC for S3 Bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "this" {
  count               = data.aws_caller_identity.this.id != "000000000000" ? 1 : 0
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_200"

  origin {
    domain_name              = aws_s3_bucket.this.bucket_regional_domain_name
    origin_id                = local.origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  dynamic "origin" {
    for_each = local.function_origins
    content {
      domain_name = origin.value.domain_name
      origin_id   = origin.value.origin_id

      dynamic "custom_header" {
        for_each = origin.value.name == "api" ? [1] : [1]
        content {
          name  = origin.value.name == "api" ? "X-Workshop-Token" : "X-Forwarded-Host"
          value = origin.value.name == "api" ? "workshop-9cf86d54-secret" : origin.value.domain_name
        }
      }

      dynamic "custom_origin_config" {
        for_each = origin.value.name == "api" ? [1] : []
        content {
          http_port              = 80
          https_port             = 443
          origin_protocol_policy = "https-only"
          origin_ssl_protocols   = ["TLSv1.2"]
        }
      }
    }
  }


  #   include_cookies = false
  #   bucket          = var.aws_bucket
  #   prefix          = "cdn_website_logs/"
  # }

  dynamic "ordered_cache_behavior" {
    for_each = local.function_origins
    content {
      path_pattern     = ordered_cache_behavior.value.name == "api" ? "/api/*" : "/api/${ordered_cache_behavior.value.name}*"
      target_origin_id = ordered_cache_behavior.value.origin_id

      allowed_methods        = ["GET", "HEAD", "OPTIONS", "DELETE", "PATCH", "POST", "PUT"]
      cached_methods         = ["GET", "HEAD"]
      viewer_protocol_policy = "redirect-to-https"

      # Use managed cache policy for no caching (CachingDisabled: 41357724-41e3-467d-9214-4113fa13824f)
      cache_policy_id = "41357724-41e3-467d-9214-4113fa13824f"

      # Forward all viewer headers except Host so Authorization reaches the backend.
      origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"

      # Legacy cache settings (commented out - using managed policies above)
      # min_ttl     = 0
      # default_ttl = 0
      # max_ttl     = 0

      # forwarded_values {
      #   query_string = true
      #   headers      = ["*"]

      #   cookies {
      #     forward = "all"
      #   }
      # }
    }
  }

  default_cache_behavior {
    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods  = ["GET", "HEAD"]

    default_ttl = 3600
    max_ttl     = 86400
    min_ttl     = 0

    target_origin_id       = local.origin_id
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_rewrite.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = local.app_tags
}

resource "aws_s3_bucket_policy" "this" {
  count  = data.aws_caller_identity.this.id != "000000000000" ? 1 : 0
  bucket = aws_s3_bucket.this.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = data.aws_service_principal.cloudfront.name
        }
        Action   = "s3:GetObject"
        Resource = format("%s/*", aws_s3_bucket.this.arn)
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = format(
              "arn:aws:cloudfront::%s:distribution/%s",
              data.aws_caller_identity.this.account_id,
              element(aws_cloudfront_distribution.this.*.id, count.index)
            )
          }
        }
      }
    ]
  })
}
resource "aws_cloudfront_function" "spa_rewrite" {
  name    = "spa-rewrite-${local.app_id}"
  runtime = "cloudfront-js-1.0"
  comment = "Rewrite SPA routes to /index.html"
  publish = true
  code    = <<EOF
function handler(event) {
  var request = event.request;
  var uri = request.uri || "/";
  // Leave API calls alone
  if (uri.startsWith("/api/")) {
    return request;
  }
  // Leave static assets (with file extension) alone
  if (uri.indexOf(".") !== -1 || uri === "/") {
    return request;
  }
  // Everything else is an SPA route -> /index.html
  request.uri = "/index.html";
  return request;
}
EOF
}
